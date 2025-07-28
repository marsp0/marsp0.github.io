# HTML Tree Construction
_14.07.2025 - 27.07.2025; 34h_


> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

This sprint was shorter than usual due to some external factors. I worked on getting test structure similar to the tokenizer. I arrived at something that works for now, not sure if this will be the final form as i still have my doubts about the structure of `html_node_t`.

## Input

The input comes from the [html5lib-tests](https://github.com/html5lib/html5lib-tests) repository. The structure is as follows

```c
#data
Line1<br>Line2<br>Line3<br>Line4
#errors
(1,0): expected-doctype-but-got-chars
#document
| <html>
|   <head>
|   <body>
|     "Line1"
|     <br>
|     "Line2"
|     <br>
|     "Line3"
|     <br>
|     "Line4"
```

- `#data` - contains the raw buffer passed to the parser
- `#errors` - the list of expected errors
- `#document` - represents the final expected html document tree

There are some additional types of sections for more advanced features but i will stick to the above for the initial version of the parser.

## Test structure

I have arrived at the following structure

```c
static void test_when_input_is_pure_text_then_add_missing_nodes()
{
    // #data
    // Test
    // #errors
    // (1,0): expected-doctype-but-got-chars
    // #document
    // | <html>
    // |   <head>
    // |   <body>
    // |     "Test"
    
    unsigned char buffer[] = "Test";
    html_node_t* document   = html_document_new();
    html_node_t* html       = html_element_new(document, "html", 4);
    html_node_t* head       = html_element_new(document, "head", 4);
    html_node_t* body       = html_element_new(document, "body", 4);
    html_node_t* text       = html_text_new(document, "Test", 4);

    APPEND_TO_TREE(document, html);
    APPEND_TO_TREE(html, head);
    APPEND_TO_TREE(html, body);
    APPEND_TO_TREE(body, text);

    RUN_TEST_AND_ASSERT_DOCUMENT(buffer, document);
}
```

Similar to the tokenizer tests, we define the input buffer and then assert expectation. 

`APPEND_TO_TREE` handles the appropriate logic to add a node to the tree. This can be done with one of the `html_node_t` functions so i might change it at a later point.

```c
#define APPEND_TO_TREE(root, node)                                                      \
do                                                                                      \
{                                                                                       \
    html_node_t* last_child = root->last_child;                                         \
    if (last_child)                                                                     \
    {                                                                                   \
        last_child->next_sibling = node;                                                \
        node->prev_sibling = last_child;                                                \
        root->last_child = node;                                                        \
    }                                                                                   \
    else                                                                                \
    {                                                                                   \
        root->first_child = node;                                                       \
        root->last_child = node;                                                        \
    }                                                                                   \
} while(0);
```

`RUN_TEST_AND_ASSERT_DOCUMENT` macro parses the buffer, gets a tree back and uses a recursive function to compare the nodes.

```c
#define RUN_TEST_AND_ASSERT_DOCUMENT(buffer, expected)                                  \
do                                                                                      \
{                                                                                       \
    html_parser_init();                                                                 \
    html_node_t* actual = html_parser_run(buffer, sizeof(buffer) - 1);                  \
    ASSERT_NODE(actual, expected);                                                      \
    html_node_free(expected);                                                           \
    html_node_free(actual);                                                             \
    html_parser_free();                                                                 \
} while (0);
```

After a lot of back and forth on how to handle the parser implementation (i mean a lot) I have now settled on something. The parser is a huge switch statement full of `NOT_IMPLEMENTED` calls. I add a test and implement the related missing functionality (within reason). There are some things I prefer to leave for the future (fragment parsing, scripting stuff etc). This way, i do not feel overwhelmed and can take small steps forward.

This is what a snippet of the parser looks like atm

```c
html_node_t* html_parser_run(const unsigned char* buffer, const uint32_t size)
{
    html_tokenizer_init(buffer, size, tokens, MAX_TOKENS);

    mode                        = HTML_PARSER_MODE_INITIAL;

    document                    = html_document_new();
    
    bool will_use_rules_for     = false;
    bool use_rules_for          = false;
    html_node_t* head_element   = NULL;
    html_node_t* form_element   = NULL;
    bool scripting_enabled      = false;

    while (!stop)
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

            ... MORE

            // https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inhead
            case HTML_PARSER_MODE_IN_HEAD:
                if (is_character && (t.data[0] == '\t' || t.data[0] == '\n' || t.data[0] == '\f' || t.data[0] == '\r' || t.data[0] == ' '))
                {
                    insert_character(&t);
                }
                else if (is_comment)
                {
                    insert_comment(&t, NULL);
                }
                else if (is_doctype)
                {
                    // todo: parse error, ignore token
                }
                else if (is_start && name_is(HTML, HTML_SIZE, &t))
                {
                    consume             = false;
                    mode                = HTML_PARSER_MODE_IN_BODY;
                    original_mode       = HTML_PARSER_MODE_IN_HEAD;
                    will_use_rules_for  = true;
                }
                else if (is_start && (name_is(BASE, BASE_SIZE, &t) ||
                                      name_is(BASEFONT, BASEFONT_SIZE, &t) ||
                                      name_is(BGSOUND, BGSOUND_SIZE, &t) ||
                                      name_is(LINK, LINK_SIZE, &t)))
                {
                    insert_html_element(t.name, t.name_size);
                    stack_pop();

                    // todo: ack self closing tag
                }
                else if (is_start && name_is(META, META_SIZE, &t))
                {
                    insert_html_element(t.name, t.name_size);
                    stack_pop();

                    // todo: ack self closing tag
                    // todo: speculative parsing logic
                }
                else if (is_start && name_is(TITLE, TITLE_SIZE, &t))
                {
                    insert_html_element(t.name, t.name_size);
                    html_tokenizer_set_state(HTML_TOKENIZER_RCDATA_STATE);

                    original_mode       = mode;
                    mode                = HTML_PARSER_MODE_TEXT;
                }
                else if ((is_start && name_is(NOSCRIPT, NOSCRIPT_SIZE, &t) && scripting_enabled) || 
                         (is_start && (name_is(NOFRAMES, NOFRAMES_SIZE, &t) || name_is(STYLE, STYLE_SIZE, &t))))
                {
                    insert_html_element(t.name, t.name_size);
                    html_tokenizer_set_state(HTML_TOKENIZER_RAWTEXT_STATE);

                    original_mode       = mode;
                    mode                = HTML_PARSER_MODE_TEXT;
                }
                else if (is_start && name_is(NOSCRIPT, NOSCRIPT_SIZE, &t) && !scripting_enabled)
                {
                    insert_html_element(t.name, t.name_size);
                    mode                = HTML_PARSER_MODE_IN_HEAD_NOSCRIPT;
                }
                else if (is_start && name_is(SCRIPT, SCRIPT_SIZE, &t))
                {
                    NOT_IMPLEMENTED
                }
                else if (is_end && name_is(HEAD, HEAD_SIZE, &t))
                {
                    stack_pop();
                    mode                = HTML_PARSER_MODE_AFTER_HEAD;
                }
                else if (is_start && name_is(TEMPLATE, TEMPLATE_SIZE, &t))
                {
                    NOT_IMPLEMENTED
                }
                else if (is_end && name_is(TEMPLATE, TEMPLATE_SIZE, &t))
                {
                    NOT_IMPLEMENTED
                }
                else if ((is_start && name_is(HEAD, HEAD_SIZE, &t)) ||
                         (is_end && !(name_is(BODY, BODY_SIZE, &t) ||
                                      name_is(HTML, HTML_SIZE, &t) ||
                                      name_is(BR, BR_SIZE, &t))))
                {
                    // todo: parse error
                    NOT_IMPLEMENTED
                }
                else
                {
                    stack_pop();
                    mode                = HTML_PARSER_MODE_AFTER_HEAD;
                    consume             = false; 
                }
                break;
            
            ... MORE
            }

            if (use_rules_for)      { use_rules_for = false; mode = original_mode; }
            if (will_use_rules_for) { will_use_rules_for = false; use_rules_for = true; }
            if (consume)            { i++; }
        }
    }

    html_tokenizer_free();

    return document;
}
```

This approach seems to be working better than my previous attempts so for next sprint I will continue adding tests and implementation logic to the parser. The biggest problem now is deciding which parts should be implemented for the initial version and which parts should be postponed. The guiding principle I try to follow is "Is this logic necessary to parse a simple html document with no attributes?". Sometimes it seems that it is necessary, but as i start implementation I see that its not actually needed and changes have to be reverted.

Martin
