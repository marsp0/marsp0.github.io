# HTML Tree Construction
_14.07.2025 - 27.07.2025; TODOh_

> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

## 20.05.25

The plan is to go back to testing the parser, i am not familiar with how the node interfaces will look in the end so for now its better to just test from the perspective of the parser.

#### Part 1 - I will continue with the same test from 15.07.2025. Goals

- [x] assert tree structure
- [x] assert local name
- [x] assert tag name
- [x] assert type

stretch goal:

- [x] assert name
- [x] assert namespace

#### Part 2 -  Secondary goal

Make below test pass

```c
// #data
// <p>One<p>Two
// #errors
// (1,3): expected-doctype-but-got-start-tag
// #document
// | <html>
// |   <head>
// |   <body>
// |     <p>
// |       "One"
// |     <p>
// |       "Two"
```

At the moment, the above test produces a wrong tree. The second P element is placed under the first, as opposed to alongside it. This is because the code does not perform necessary scope checks.

__html/parser.c:1057__ - this is where the fix should be placed.

## 19.05.25 - day off

## 18.05.25 - day off

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
