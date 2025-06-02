# HTML Parsing and UTF8 Validation

_19.05.2025 - 01.06.2025_

> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

This article covers the work completed during the first sprint of the project. The main task for this sprint was to implement an HTML parser that can take a raw UTF-8 encoded buffer and produce testable output (though the exact form of the final output is still not 100% clear).

The sprint was two weeks long, but due to external factors, I was only able to spend approximately 20 hours on the project. The work items I completed are listed below:

- Repository setup
- UTF-8 utility capable of validating and decoding raw buffers
- Simple testing framework
- Final (hopefully!) implementation plan for the tokenizer described in the spec

## Repository setup

Fairly straightforward boilerplate setup. The only difference is that, for now, I won't be using a build system like CMake or Make. Instead, I'm starting with a single-file build script. The goal is to keep things simple—even as the project grows. That might be difficult to maintain, so I’ll keep it in mind and consider switching to a proper build system if it becomes necessary.

Current build script setup:

```sh
#!/bin/bash

# used RADDebugger build script as reference- https://github.com/EpicGamesExt/raddebugger

# ----- args
for arg in "$@";        do declare $arg='1'; done
if [ ! -v debug ];      then release=1; fi

# ----- defines
gcc_include="-I./src/"
gcc_flags="-std=gnu11 -Wall -Wextra -Werror -Wshadow -Wpedantic -Wnull-dereference -Wunused -Wconversion -Wno-pointer-sign"
gcc_compile="gcc -O2 ${gcc_include} ${gcc_flags}"
gcc_debug="gcc -g -O0 ${gcc_include} ${gcc_flags}"
gcc_link="-lpthread -lm -lrt -ldl"

if [ -v debug ]; then gcc_compile=${gcc_debug}; fi

# ----- src files
main_file="./src/main.c"
#html_files="./src/html/parser.c"
util_files="./src/util/utf8.c"

src_files="${html_files} ${util_files}"

# ----- test files
test_main_file="./test/test_main.c ./test/test_utils.c"
test_util_files="./test/util/test_utf8.c"

test_files="${test_util_files}"

# ----- build
mkdir -p out
rm -rf ./out/*

echo "Compile tests"
files="${test_main_file} ${src_files} ${test_files}";
${gcc_compile} -I./test ${files} ${gcc_link} -o ./out/test_vl;

echo "Compile browser"
files="${main_file} ${src_files}";
${gcc_compile} ${files} ${gcc_link} -o ./out/vl;

```

I realize there are plenty of disadvantages to this approach, but I’m willing to adapt and make changes as the project’s shape and needs become clearer.

## UTF8 validation and decoding

As a start the browser will only support UTF8 encoded pages. Eventually more encodings will follow or a translation layer will be added. The current interface looks like this

```c
bool    utf8_validate(unsigned char* buffer, uint32_t size);
int32_t utf8_code_point(unsigned char* buffer, uint32_t size, uint32_t cursor, uint32_t* value);
bool    utf8_is_upper_alpha(uint32_t code_point);
bool    utf8_is_lower_alpha(uint32_t code_point);
bool    utf8_is_alpha(uint32_t code_point);
```

The [wiki page on UTF8](https://en.wikipedia.org/wiki/UTF-8) is very well written and I used it as my main reference point. The above interface will most likely change but it is good enough as a starting point.

## Simple testing framework

I reused a unit testing framework I wrote for my previous project (pbr-software-renderer) and removed the stuff specific to the renderer. The framework provides some utility macros to make comparison and output formatting a bit more friendly, but it is very barebones and will have to be extended. The `main` file for the test looks like this:

```c
#include "test_utils.h"                                         # testing macros and functions

#include "util/test_utf8.h"                                     # unit tests

int32_t main()
{
    TESTS_INIT();
    TEST_GROUP(test_utf8);
    TESTS_SUMMARY();
    int32_t exit_code = TESTS_FAIL_COUNT() > 0 ? 1 : 0;
    return exit_code;
}
```

The `test_utils.h` provides all test related utilities. 

```c
#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <math.h>
#include <string.h>

void        increment_test_assert_counter();
void        reset_test_assert_counter();
uint32_t    get_test_assert_counter();
void        TESTS_INIT();
void        TESTS_SUMMARY();
uint32_t    TESTS_FAIL_COUNT();

#define GET_COMPARISON(a, b) ...
#define GET_FORMAT(a) ...
#define ASSERT_EQUAL(a, b) ...
#define ASSERT_TRUE(a) ...
#define ASSERT_FALSE(a) ...
#define ASSERT_POINTER(a, b)...
#define ASSERT_STRING(a, b, size) ...
#define TEST_CASE(test) ...
#define TEST_GROUP(group)  ...
```

## Tokenizer

The spec is very explicit about what needs to happen and when—which is great—but it can also feel overwhelming when starting from scratch. I chose the tokenizer as my starting point, but here’s the complete processing pipeline:

```
                                                     
           ┌─────────┐                               
           │ Network │                               
           └────┬────┘                               
                │                                    
                │                                    
                │                                    
         ┌──────▼───────┐                            
         │ Byte stream  │                            
         │   decoder    │                            
         └──────┬───────┘                            
                │                                    
                │                                    
                │                                    
         ┌──────▼────────┐                           
         │ Input stream  │                           
         │ preprocessor  │                           
         └──────┬────────┘                           
                │                                    
                │                                    
                │                                    
          ┌─────▼─────┐                              
          │ Tokenizer ◄──────────────────────┐       
          └─────┬─────┘                      │       
                │                            │       
                │                            │       
                │                            │       
         ┌──────▼────────┐              ┌────┼────┐  
         │    Tree       ┼──────────────► Script  │  
         │ Construction  │              └─────────┘  
         └──────┬────────┘                           
                │                                    
                │                                    
             ┌──▼───┐                                
             │ DOM  │                                
             └──────┘                                
                                                     
```

Script handling is a long way off, so for now, the parser will take a complete buffer and produce a DOM tree. The rest will come later. There will be a lot of refactoring along the way, but that’s fine.

I initially tried to reduce the memory usage of the tokenizer, but I realized that was just premature optimization. There's no need to overthink it at this stage. I still don’t have the full picture in mind, so making those kinds of decisions now wouldn’t be very useful.

This is what the initial version will look like:

```c
#pragma once

#define HTML_TOKEN_MAX_NAME_LEN     64
#define HTML_TOKEN_MAX_ATTRIBUTES   5

typedef enum
{
    HTML_TOKENIZER_OK,
    HTML_TOKENIZER_DONE,
    HTML_TOKENIZER_ERROR,

} html_tokenizer_status_e;

// https://html.spec.whatwg.org/multipage/parsing.html#tokenization
typedef enum
{
    HTML_DOCTYPE_TOKEN,
    HTML_START_TOKEN,
    HTML_END_TOKEN,
    HTML_COMMENT_TOKEN,
    HTML_CHARACTER_TOKEN,
    HTML_EOF_TOKEN,

} html_token_type_e;

typedef struct
{
    uint32_t        name[HTML_TOKEN_MAX_NAME_LEN];
    uint32_t        name_size;
    uint32_t        value[HTML_TOKEN_MAX_NAME_LEN];
    uint32_t        value_size;

} html_token_attribute_t;

typedef struct
{
    bool            is_valid;
    token_type_e    type;

    uint32_t        name[HTML_TOKEN_MAX_NAME_LEN];
    uint32_t        name_size;

    // DOCTYPE
    uint32_t        public_id[HTML_TOKEN_MAX_NAME_LEN];
    uint32_t        public_id_size;
    uint32_t        system_id[HTML_TOKEN_MAX_NAME_LEN];
    uint32_t        system_id_size;
    bool            force_quirks;

    // start/end tags
    attribute_t     attributes[MAX_ATTRIBUTES];
    uint32_t        attributes_size;
    bool            self_closing;

    // comments and character tokens
    uint32_t        data[HTML_TOKEN_MAX_NAME_LEN];
    uint32_t        data_size;

} html_token_t;

void                    html_tokenizer_init(const unsigned char* new_buffer, const uint32_t new_size, const html_token_t* new_tokens, const uint32_t new_tokens_size);
html_tokenizer_status   html_tokenizer_next();
void                    html_tokenizer_free();

```

The parser code will be the only caller to the tokenizer and im thinking that it will look something like this (pseudocode):

```c
// void return as im not sure what the return will look like for now
void parse(unsigned char* buffer, uint32_t size, ...)
{
    html_token_t out_array[MAX_TOKENS];
    html_tokenizer_init(buffer, size, out_array, MAX_TOKENS);
    
    while (tree_not_complete)
    {
        html_tokenizer_next();
        for token in out_array
        {
            if token not valid: break;
            // process token
        }
    }

    html_tokenizer_free();
}
```

The implementation of `html_token_next` is described in the spec as a [state machine](https://html.spec.whatwg.org/multipage/parsing.html#tokenization), with 80 states that need to be handled.

Currently, there are two issues I've added to the backlog:

- `html_token_t` holds all strings as fixed-length arrays  
- Some states can produce an unbounded number of tokens, so the fixed array won’t be enough  

In the next sprint, I’ll focus on completing the state machine code and—if possible—start work on DOM creation based on the tokens.
