# HTML Tree Construction
_30.06.2025 - 13.07.2025; 50h_

> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

This sprint the focus was on the tree construction stage that consumes the output of the tokenizer. The amount of stuff going on in the parsing stage is quite overwhelming.

## Tree construction

Much like the tokenizer, this module is essentially a large state machine. It has fewer states, but each one is significantly more complex. My initial plan was to approach it the same way I handled the tokenizer: start at the top and implement the states and transitions one by one as I encountered them. Once most of the logic was in place, I would move on to writing tests.

However, I quickly ran into issues. I found myself spending only about 20% of my time on the state machine logic, and the other 80% on supporting functionality—functions used to manage state and manipulate the document tree. The challenge is that without having a full view of the entire state machine, it's hard to predict who will call these helper functions and how they'll be used. As a result, when a new state or transition required changes to one of these functions, I couldn’t be sure if it would break existing call sites.

After running into this problem repeatedly, I decided to revise my approach. From now on, I’ll write tests as I implement each state. This way, I can catch regressions early and ensure that changes to the underlying logic don’t break previously implemented functionality. This is a departure from the tokenizer strategy, but the tokenizer's internal logic was simpler and more predictable.

```c
void html_parser_run(const unsigned char* buffer, const uint32_t size)
{
    html_tokenizer_init(buffer, size, tokens, MAX_TOKENS);

    mode                        = HTML_PARSER_MODE_INITIAL;

    document                    = html_document_new();

    while (true)
    {
        html_tokenizer_error_e err  = html_tokenizer_next();
        uint32_t tokens_size        = get_tokens_size();
        uint32_t i                  = 0;

        if (err != HTML_TOKENIZER_OK || tokens_size == 0) { break; }


        while (i < tokens_size)
        {
            bool consume = true;
            html_token_t t = tokens[i];

            bool is_doctype     = t.type == HTML_DOCTYPE_TOKEN;
            bool is_start       = t.type == HTML_START_TOKEN;
            bool is_end         = t.type == HTML_END_TOKEN;
            bool is_comment     = t.type == HTML_COMMENT_TOKEN;
            bool is_character   = t.type == HTML_CHARACTER_TOKEN;
            bool is_eof         = t.type == HTML_EOF_TOKEN;

            switch (mode)
            {

            // https://html.spec.whatwg.org/multipage/parsing.html#the-initial-insertion-mode
            case HTML_PARSER_MODE_INITIAL:
                if (is_character && (t.data[0] == '\t' || t.data[0] == '\n' || t.data[0] == '\f' || t.data[0] == '\r' || t.data[0] == ' '))
                {
                    // ignore
                }
                else if (is_comment)
                {
                    
                }
                else if (is_doctype)
                {
                    
                }
                else
                {
                    
                }
                break;

            // https://html.spec.whatwg.org/multipage/parsing.html#the-before-html-insertion-mode
            case HTML_PARSER_MODE_BEFORE_HTML:
                if (is_doctype)
                {
                    // todo: parse error
                }
                else if (is_comment)
                {
                    
                }
                else if (is_character && (t.data[0] == '\t' || t.data[0] == '\n' || t.data[0] == '\f' || t.data[0] == '\r' || t.data[0] == ' '))
                {
                    // ignore
                }
                else if (is_start && name_is(HTML, HTML_SIZE, &t))
                {
                    
                }
                else if (is_end && !(name_is(HTML, HTML_SIZE, &t) ||
                                     name_is(HEAD, HEAD_SIZE, &t) ||
                                     name_is(BODY, BODY_SIZE, &t) ||
                                     name_is(BR, BR_SIZE, &t)))
                {
                    // todo: parse error, ignore token
                }
                else
                {
                    
                }
                break;

            // ...
            }
        }
    }

    html_tokenizer_free();
}
```

## Node interfaces

I've started implementing the various node interfaces as defined in the [DOM specification](https://dom.spec.whatwg.org/#nodes). The implementation is still incomplete, and I'm fairly certain that even the current definitions will evolve over time. Here's a quick snippet to illustrate the structure: everything is represented as a `html_node_t`, and depending on the node type, additional attributes are available through more specific structures like `html_node_document_t` or `html_node_element_t`.

```c
// https://dom.spec.whatwg.org/#interface-node
typedef struct html_node_t
{
    html_node_type_e    type;
    unsigned char       name[MAX_HTML_NAME_LEN];
    uint32_t            name_size;

    unsigned char       base_uri[MAX_HTML_NAME_LEN];
    uint32_t            base_uri_size;

    bool                is_connected;

    // ... more attributes

    union
    {
        html_node_document_t*                   document_data;
        html_node_doctype_t*                    doctype_data;
        html_node_doc_frag_t*                   document_fragment;
        html_node_shadow_root_t*                shadow_root;
        html_node_element_t*                    element_data;
        html_node_character_data_t*             character_data;
        html_node_text_t*                       text_data;
        html_node_cdata_section_t*              cdata_section;
        html_node_processing_instruction_t*     processing_instruction;
        html_node_comment_t*                    comment_data;
    };

} html_node_t;

// https://dom.spec.whatwg.org/#interface-document
typedef struct
{
    unsigned char   url[MAX_HTML_NAME_LEN];
    uint32_t        url_size;
    unsigned char   uri[MAX_HTML_NAME_LEN];
    uint32_t        uri_size;
    unsigned char   compat_mode[MAX_HTML_NAME_LEN];
    uint32_t        compat_mode_size;
    unsigned char   character_set[MAX_HTML_NAME_LEN];
    uint32_t        character_set_size;
    unsigned char   content_type[MAX_HTML_NAME_LEN];
    uint32_t        content_type_size;

    struct html_node_t* doctype;

    bool parser_cannot_change_mode;
} html_node_document_t;
```

Theres more but they follow the exact same structure. As the parser work progresses the structure of these nodes will become more clear so I am not too worried about it.

## Tests

I am planning to match the structure of the tokenizer tests and create some boilerplate macros to help with the repetition. Example of a tokenizer test below:

```c
static void test_2()
{
    const char buffer[]                         = "&#0000;";
    const html_tokenizer_state_e states[]       = { HTML_TOKENIZER_RCDATA_STATE };
    const uint32_t sizes[]                      = { 1, 1 };
    const html_tokenizer_error_e errors[]       = { HTML_TOKENIZER_NULL_CHARACTER_REFERENCE,
                                                    HTML_TOKENIZER_OK };
    const html_token_t tokens_e[][MAX_TOKENS]   = { { {.is_valid = true, .type = HTML_CHARACTER_TOKEN, .data_size = 3, .data = { [0] = 0xef, [1] = 0xbf, [2] = 0xbd } } },
                                                    { {.is_valid = true, .type = HTML_EOF_TOKEN } } };
    RUN_TEST_AND_ASSERT_TOKENS(buffer, states, sizes, errors, tokens_e);
}
```

The macro `RUN_TEST_AND_ASSERT_TOKENS` is reused in all tokenizer tests:

```c
#define RUN_TEST_AND_ASSERT_TOKENS(buffer, states, sizes, errors, tokens_e)             \
do                                                                                      \
{                                                                                       \
    html_token_t tokens[MAX_TOKENS] = { 0 };                                            \
                                                                                        \
    const uint32_t buffer_size      = sizeof(buffer) - 1;                               \
    const uint32_t states_size      = sizeof(states) / sizeof(html_tokenizer_state_e);  \
    const uint32_t sizes_size       = sizeof(sizes) / sizeof(uint32_t);                 \
    const uint32_t errors_size      = sizeof(errors) / sizeof(html_tokenizer_error_e);  \
    const uint32_t tokens_e_size    = sizeof(tokens_e) / MAX_TOKENS / sizeof(html_token_t);          \
                                                                                        \
    for (uint32_t s = 0; s < states_size; s++)                                          \
    {                                                                                   \
        memset(tokens, 0, sizeof(tokens));                                              \
        html_tokenizer_init(buffer, buffer_size, tokens, MAX_TOKENS);                   \
        html_tokenizer_set_state(states[s]);                                            \
                                                                                        \
        for (uint32_t i = 0; i < MAX_TOKENS; i++) { ASSERT_FALSE(tokens[i].is_valid); } \
                                                                                        \
        ASSERT_EQUAL(sizes_size, errors_size);                                          \
        ASSERT_EQUAL(tokens_e_size, errors_size);                                       \
                                                                                        \
        for (uint32_t i = 0; i < sizes_size; i++)                                       \
        {                                                                               \
            html_tokenizer_error_e err_e    = errors[i];                                \
            html_tokenizer_error_e err_a    = html_tokenizer_next();                    \
            ASSERT_EQUAL(err_a, err_e);                                                 \
                                                                                        \
            uint32_t size_e = sizes[i];                                                 \
            uint32_t size_a = 0;                                                        \
            for (uint32_t k = 0; k < MAX_TOKENS; k++)                                   \
            {                                                                           \
                if (tokens[k].is_valid) { size_a++; }                                   \
            }                                                                           \
            ASSERT_EQUAL(size_a, size_e);                                               \
                                                                                        \
            for (uint32_t j = 0; j < size_e; j++)                                       \
            {                                                                           \
                html_token_t token_e = tokens_e[i][j];                                  \
                ASSERT_TOKEN(tokens[j], token_e);                                       \
            }                                                                           \
        }                                                                               \
    }                                                                                   \
} while (0);                                                                            \
```

It took a few iterations to arrive at this structure, but I’m hoping I can apply a similar approach to the parser as well. For testing, I’ll be using the test definitions from the [html5lib-tests](https://github.com/html5lib/html5lib-tests) repository, which should provide good coverage and help guide the implementation.

Martin
