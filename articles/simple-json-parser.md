## Simple JSON parser

_03.03.2023_

In this post I'll talk about a simple JSON parser I implemented for a project that I'm working on. I didn't want this to be a fully featured library like [cJSON](https://github.com/DaveGamble/cJSON) but rather a simple and easy to use parser. To keep the code straightforward i've made some assumptions that a generic library like cJSON might not be able to make:

- the buffer can fit in memory
- the buffer contains only **ASCII** characters
- the buffer contains valid json. Since im parsing `glb` files im assuming that the json inside them is valid. The buffer has to contain at least a root node `{}`. Nothing else is supported at top level (not even an empty string).

The code is single threaded and does not support the creation and exporting of json trees, all it does is it takes in a buffer and parses it. The code works in two stages where each stage iterates over the entire buffer. The first stage calculates and allocates the memory needed for the entire json tree and the second stage parses the tree. The idea is to make the memory allocation more efficient by precalculating the amount of memory needed for both strings and nodes and allocating two big chunks instead of doing per node allocation. 

The first thing we can look at is the header file `json.h`

```c
// json.h

#pragma once

#include <stdint.h>
#include <stdbool.h>

typedef enum
{
    JSON_NUMBER,
    JSON_REAL,
    JSON_STRING,
    JSON_OBJECT,
    JSON_ARRAY,
    JSON_BOOL,
    JSON_NULL,
} json_type_e;

typedef struct json_node_t
{
    struct json_node_t* child;
    struct json_node_t* next;
    struct json_node_t* parent;
    unsigned char*      key;
    uint32_t            key_size;
    uint32_t            size;       /*used for arrays, object nodes and strings*/
    json_type_e         type;

    union
    {
        bool            boolean;
        float           real;
        int32_t         integer;
        uint32_t        uinteger;
        unsigned char*  string;
    };

} json_node_t;

typedef struct
{
    unsigned char*  strings;
    json_node_t*    nodes;
    uint32_t        strings_size;
    uint32_t        nodes_size;
} json_t;

json_t*             json_new(const unsigned char* input, uint32_t input_size);
void                json_free(json_t* json);
const json_node_t*  json_find_node(const json_t* json, uint32_t arg_count, ...);
const json_node_t*  json_find_child(const json_node_t* json, const char* key);
const json_node_t*  json_find_index(const json_node_t* json, uint32_t index);
```

As you can see the parser has a very basic api with the most interesting part being the `json_t` type that acts as a container for all the nodes and strings. All strings are laid out together in one continuous array and the same is done for the nodes. The nodes are laid out in depth first manner as shown below. The `child`, `next` and `parent` members of the `json_node_t` hold pointers to other elements in the array. Here is an example

```json
{ "key1": "val1", "key2": [1] }
```

```
strings


                +---+---+---+---+---+---+---+---+---+---+---+---+
                | k | e | y | 1 | v | a | l | 1 | k | e | y | 2 |
                +---+---+---+---+---+---+---+---+---+---+---+---+
                  |               |               |
                  |               |               |
                  |               +-+           +-+
nodes             +----------+      |           |
                             |      |           |
                             |      |           |
+==================+=========|======|=+=========|======|=+==================+
| key              | key ----+      | | key ----+      | | key              |
| key_size = 0     | key_size = 4   | | key_size = 4   | | key_size = 0     |
| type JSON_OBJ    | type JSON_STR  | | type JSON_ARR  | | type JSON_INT    |
|                  | string  -------+ |                  | integer 1        |
|                  | string_size = 4  | size = 1         |                  |
| child ---------+ | child NULL       | child ---------+ | child NULL       |
| next NULL      | | next -------+    | next NULL      | | next NULL        |
| parent NULL    | | parent --+  |    | parent --+     | | parent --+       |
|                | |          |  |    |          |     | |          |       |
+========^=======|=+====^=====|==|====+=====^====|==^==|=+====^=====|=======+
         |       |      |     |  |          |    |  |  |      |     |
         |       +------+     |  +----------+    |  |  +------+     |
         +--------------------+------------------+  +---------------+
```

Lets see how the above is achieved by looking through the code for `json_new`.

```c
// json.c

typedef enum
{
    BEFORE_KEY,
    IN_KEY,
    BEFORE_VAL,
    IN_VAL,
} status_e;

static uint32_t cursor             = 0;
static uint32_t buffer_size        = 0;
static const unsigned char* buffer = NULL;

static json_t* result              = NULL;
static json_node_t* nodes          = NULL;
static uint32_t node_index         = 0;
static unsigned char* strings      = NULL;
static uint32_t string_index       = 0;

json_t* json_new(const unsigned char* input, uint32_t input_size)
{
    // set static vars
    buffer = input;
    buffer_size = input_size;
    result = malloc(sizeof(json_t));
    
    // allocate memory
    allocate();

    // set more static vars
    cursor = 0;
    node_index = 0;
    string_index = 0;
    nodes = result->nodes;
    strings = result->strings;

    // parse buffer
    parse_object(node_index++);

    return result;
}
```

All these static variables are here to avoid passing them as parameters to the static functions that we will look next. The two function calls (`allocate` and `parse_object`) represent the two stages i talked about previously.

### First stage - memory allocation

During the first stage the code iterates over the buffer and calculates how much space is going to be needed for strings and nodes.

Strings - everything between quotes is counted as part of the string. The only special case are escaped double quotes. They need special care to prevent the string counter from stopping prematurely. The code has to also allocate a single byte instead of two.

Nodes - the code uses symbols `,`, `]` and `}` to count the elements. The root node is always present, the comma is used to count internal elements to both objects and arrays and the closing brackets/parenthesis are used to count the final element of the container. Brackets/parenthesis inside the strings are skipped.

```c
//json.c

static void allocate(void)
{
    // TODO: store repeating strings once

    cursor = 0;
    unsigned char c;
    unsigned char t;

    uint32_t ssize = 0;
    uint32_t nsize = 1; // always 1 node for the root
    status_e status = BEFORE_KEY;

    while(cursor < buffer_size)
    {
        c = buffer[cursor];

        // string allocation
        if (c == '"' && status == BEFORE_KEY)
        {
            status = IN_KEY;
        }
        else if (c == '"' && status == IN_KEY) 
        {
            status = BEFORE_KEY;
        }
        else if (status == IN_KEY)
        {
            ssize++;

            // handle escape sequences
            t = buffer[cursor + 1];

            if (c == '\\' && (t == '"' || t == '\\'|| 
                              t == 't' || t == 'b' || 
                              t == 'f' || t == 'n' || 
                              t == 'r'))
            {
                cursor++;
            }
        }

        // node allocation
        if (status != IN_KEY && (c == ',' || c == ']' || c == '}'))
        {
            nsize += 1;
        }
        else if (status != IN_KEY && (c == '[' || c == '{'))
        {
            t = c == '[' ? ']' : '}';
            
            if (skip_if_empty(t))
            {
                continue;
            }
        }

        cursor++;
    }

    result->strings = malloc(ssize + 1);
    result->strings_size = ssize;
    result->strings[ssize] = 0;
    memset(result->strings, 0, ssize);

    result->nodes = malloc(nsize * sizeof(json_node_t));
    result->nodes_size = nsize;
    memset(result->nodes, 0, nsize * sizeof(json_node_t));

    cursor = 0;
}
```

### Second stage - parsing

The parsing is done by keeping track of next available node slot and string slot. Every parse function takes a node index as argument and uses that to access the appropriate node. All nodes are parsed recursively.

#### Objects

The function below continues to parse the children of the object until it sees a closing bracket. The code parses first the key and sets the pointers to the parent/child/sibling. The value is parsed right after. `parse_value` calls a different function based on the value that is being parsed.

```c
static void parse_object(uint32_t index)
{
    json_node_t* prev = NULL;
    json_node_t* curr = NULL;
    json_node_t* parent = &nodes[index];
    status_e status = BEFORE_KEY;
    parent->type = JSON_OBJECT;
    parent->size = 0;
    cursor++;

    while(buffer[cursor] != '}')
    {
        skip_whitespace();
        if (buffer[cursor] == '"' && status == BEFORE_KEY)
        {
            parse_string_key(node_index);
            status = BEFORE_VAL;
            curr = &nodes[node_index];
            curr->parent = parent;
            parent->size++;

            if (prev)
            {
                prev->next = curr;
            }
            else
            {
                parent->child = curr;
            }

            prev = curr;
        }
        else if (status == BEFORE_VAL)
        {
            parse_value(node_index++);
            status = BEFORE_KEY;
        }
    }

    cursor++;
}

static void parse_value(uint32_t index)
{
    skip_whitespace();
    if (buffer[cursor] == '"')
    {
        parse_string_value(index);
    }
    else if (isdigit(buffer[cursor]) || buffer[cursor] == '-')
    {
        is_real() ? parse_real(index) : parse_number(index);
    }
    else if (buffer[cursor] == '{')
    {
        parse_object(index);
    }
    else if (buffer[cursor] == '[')
    {
        parse_array(index);
    }
    else if (buffer[cursor] == 'f' || buffer[cursor] == 't')
    {
        nodes[index].type = JSON_BOOL;
        nodes[index].boolean = strncmp(&buffer[cursor], "true", 4) == 0 ? true : false;
        cursor += nodes[index].boolean ? 4 : 5;
    }
    else if (strncmp(&buffer[cursor], "null", 4) == 0)
    {
        nodes[index].type = JSON_NULL;
        cursor += 4;
    }
    skip_whitespace();
}
```

#### Arrays

The code is similar to that of `parse_object` but there is no key to be parsed. Parent/sibling pointers are still updated as the children are being parsed.

```c
static void parse_array(uint32_t index)
{
    json_node_t* prev = NULL;
    json_node_t* curr = NULL;
    json_node_t* parent = &nodes[index];
    parent->type = JSON_ARRAY;
    parent->size = 0;


    if (skip_if_empty(']'))
    {
        return;
    }

    cursor++;

    while(buffer[cursor] != ']')
    {
        curr = &nodes[node_index++];
        curr->parent = parent;

        parse_value(node_index - 1);

        if (prev)
        {
            prev->next = curr;
        }
        else
        {
            parent->child = curr;
        }
        prev = curr;
        parent->size++;
    }

    cursor++;
}
```

#### Numbers

Number parsing relies on the builtin functions `atoi` and `atof`. Besides calling those functions the code has to move the cursor past the number.

```c
static void parse_number(uint32_t index)
{
    nodes[index].type = JSON_NUMBER;
    nodes[index].integer = atoi(&buffer[cursor]);

    /* update cursor to current position */
    unsigned char c = buffer[cursor];
    while(isdigit(c) || c == '-')
    {
        cursor++;
        c = buffer[cursor];
    }

}

static void parse_real(uint32_t index)
{
    nodes[index].type = JSON_REAL;
    nodes[index].real = (float)atof(&buffer[cursor]);

    /* update cursor to current position */
    unsigned char c = buffer[cursor];
    while(isdigit(c) || c == '.' || c == '-')
    {
        cursor++;
        c = buffer[cursor];
    }
}
```

#### Strings

Parsing strings is a bit more involved because there can be key strings and value strings and the string has to be copied  into the big buffer. The code uses `memcpy` for all strings except for the ones containing escaped quotes in which case it uses a `for` loop.

```c
static void parse_string(unsigned char** value, uint32_t* size)
{

    unsigned char c;
    unsigned char n;
    unsigned char t;
    uint32_t start = string_index;
    uint32_t count = 0;

    cursor++;

    while (cursor < buffer_size)
    {
        c = buffer[cursor];
        t = c;

        if (c == '"')
        {
            break;
        }
        
        if (c == '\\')
        {
            n = buffer[cursor + 1];
            if (n == '"')
            {
                t = '"';
            }
            else if (n == '\\')
            {
                t = '\\';
            }
            else if (n == 'b')
            {
                t = '\b';
            }
            else if (n == 'f')
            {
                t = '\f';
            }
            else if (n == 'n')
            {
                t = '\n';
            }
            else if (n == 'r')
            {
                t = '\r';
            }
            else if (n == 't')
            {
                t = '\t';
            }

            cursor++;
        }
        
        strings[string_index] = t;
        
        string_index++;
        count++;
        cursor++;
    }

    cursor++;

    if (count)
    {
        *size = count;
        *value = &strings[start];
    }
}

static void parse_string_key(uint32_t index)
{
    parse_string(&nodes[index].key, &nodes[index].key_size);
}

static void parse_string_value(uint32_t index)
{
    nodes[index].type = JSON_STRING;
    parse_string(&nodes[index].string, &nodes[index].size);
}
```

#### Utility

- `is_real` helps determine if the code should parse an int or a float
- `skip_if_empty` helps skip empty containers. Used when parsing and when determining the size of the nodes.
- `skip_whitespace` used to advance the cursor between keys and values

```c

static bool is_real(void)
{
    uint32_t cur = cursor;
    unsigned char c = buffer[cur];

    while(isdigit(c) || c == '.' || c == '-')
    {
        if (c == '.')
            return true;

        cur++;
        c = buffer[cur];
    }

    return false;
}

static bool skip_if_empty(unsigned char end)
{
    uint32_t cur = cursor;
    cur++;                  // move past opening bracket

    while(isspace(buffer[cur]))
        cur++;

    if (buffer[cur] == end)
    {
        cursor = ++cur;
        return true;
    }

    return false;
}

static void skip_whitespace(void)
{
    unsigned char c = buffer[cursor];
    while(isspace(c) || c == ',' || c == ':')
    {
        cursor++;
        c = buffer[cursor];
    }
}

```

### Accessing elements

The accessing of elements in the json tree is done with three main functions.

- `json_find_node` - uses variadic arguments to access nested elements in the tree. Sadly it cannot mix indices with keys.
- `json_find_child` - access direct children of a JSON_OBJECT node.
- `json_find_index` - access index from a JSON_ARRAY node.

```c

const json_node_t* json_find_node(const json_t* json, uint32_t count, ...)
{
    va_list args;
    va_start(args, count);
    const json_node_t* curr = count > 0 ? &json->nodes[0] : NULL;

    for (uint32_t i = 0; i < count; i++)
    {
        const char* key = va_arg(args, const char*);
        size_t key_len = strlen(key);
        curr = curr ? curr->child : NULL;

        while(curr)
        {
            if (key_len == curr->key_size && strncmp(key, curr->key, curr->key_size) == 0)
            {
                break;
            }

            curr = curr->next;
        }
    }

    va_end(args);
    return curr;
}

const json_node_t* json_find_child(const json_node_t* json, const char* key)
{
    if (!json || json->type != JSON_OBJECT)
    {
        return NULL;
    }

    const json_node_t* curr = json->child;
    size_t key_len = strlen(key);

    while(curr)
    {
        if (key_len == curr->key_size && strncmp(key, curr->key, curr->key_size) == 0)
        {
            return curr;
        }
        
        curr = curr->next;
    }

    return NULL;
}

const json_node_t* json_find_index(const json_node_t* json, uint32_t index)
{
    if (!json || json->type != JSON_ARRAY)
    {
        return NULL;
    }

    const json_node_t* curr = json->child;

    for (uint32_t i = 0; i < index; i++)
    {
        curr = curr ? curr->next : NULL;
    }

    return curr;
}

```

### Examples

```c

static void test_find_node_nested(void)
{
    const unsigned char buff[] = "{ \"key1\": 0.321, \"key2\": { \"inner_key1\": \"some string\"}}";

    json_t* json = json_new(buff, 56);
    const json_node_t* node = json_find_node(json, 2, "key2", "inner_key1");

    ASSERT_POINTER(&json->nodes[3], node);
    ASSERT_UINT(10, node->key_size);
    ASSERT_UINT(11, node->size);
    ASSERT_INT(JSON_STRING, node->type);
    ASSERT_STRING("inner_key1", node->key, 10);
    ASSERT_STRING("some string", node->string, 11);
    ASSERT_POINTER(NULL, node->child);
    ASSERT_POINTER(NULL, node->next);
    ASSERT_POINTER(&json->nodes[2], node->parent);

    json_free(json);
}

static void test_find_node_missing(void)
{
    const unsigned char buff[] = "{ \"key1\": 0.321, \"key2\": { \"inner_key1\": \"some string\"}}";

    json_t* json = json_new(buff, 56);

    const json_node_t* node = json_find_node(json, 2, "doesnt_exist", "inner_key1");
    ASSERT_POINTER(NULL, node);

    node = json_find_node(json, 2, "key2", "doesnt_exist");
    ASSERT_POINTER(NULL, node);

    json_free(json);
}

static void test_find_child(void)
{
    const unsigned char buff[] = "{ \"key1\": 0.321, \"key2\": { \"inner_key1\": \"some string\"}}";

    json_t* json = json_new(buff, 56);

    const json_node_t* node = json_find_child(&json->nodes[0], "key2");
    ASSERT_POINTER(&json->nodes[2], node);

    node = json_find_child(&json->nodes[0], "key3");
    ASSERT_POINTER(NULL, node);

    json_free(json);
}

static void test_find_array_element(void)
{
    const unsigned char buff[] = "{ \"key1\":  [ \"one\", \"two\"] }";
    
    json_t* json = json_new(buff, 28);

    const json_node_t* node = json_find_index(&json->nodes[1], 1);
    ASSERT_POINTER(&json->nodes[3], node);

    node = json_find_index(&json->nodes[0], 14);
    ASSERT_POINTER(NULL, node);

    json_free(json);
}
```

### Stats - Parsing

| JSON File | File Size (KB) | Time (ms) | Memory (KB) |
| - | - | - | - |
| [citm_catalog.json](https://github.com/RichardHightower/json-parsers-benchmark/blob/master/data/citm_catalog.json) | `1737` | `19` | `2283`|
| [canada.json](https://github.com/mloskot/json_benchmark/blob/master/data/canada.json) | `2199` | `46` | `9143`|
| [large-file.json](https://github.com/json-iterator/test-data/blob/master/large-file.json) | `25528` | `290` | `56426` |

### Notes

Im guessing that there will be bugs with edge cases but ill fix them as i encounter them. There are a couple of things that I'd like to improve
- Validation - no validation is performed currently which is bad
- smarter string storing - it might be a good idea to store repeating strings once instead of duplicating them
- improved find methods - I'd like to have a single method that can take both keys and indices as arguments

Comments and suggestions are welcomed [here](https://github.com/marsp0/marsp0.github.io/discussions/4) or you can send me an email(see home page).
