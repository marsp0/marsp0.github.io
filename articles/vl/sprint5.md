# HTML Tree Construction
_14.07.2025 - 27.07.2025; TODOh_

> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

## 17.07.25

Goal for today is to create some tests for node.c

EOD target:
- [x] test base nodes
- [x] test doctype
- [x] test document
- [] element nodes 
- [] text nodes

## 16.07.25 - day off

## 15.07.25

Test now passes

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
    html_node_t* document = html_document_new();
    html_node_t* html = html_element_new(document, "html", 4);
    html_node_t* head = html_element_new(document, "head", 4);
    html_node_t* body = html_element_new(document, "body", 4);
    html_node_t* text = html_text_new(document, "Test", 4);
    APPEND_TO_TREE(document, html);
    APPEND_TO_TREE(html, head);
    APPEND_TO_TREE(html, body);
    APPEND_TO_TREE(body, text);

    RUN_TEST_AND_ASSERT_DOCUMENT(buffer, document);
}
```

Martin
