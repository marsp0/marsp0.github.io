# HTML Tree Construction - Part 4
_08.09.2025 - 21.09.2025_

Nothing different in this sprint compared to the last 3 tbh. I've added the remaining tests from `tests1.dat` - almost 50. No major issues, just some steps missing here and there.

## Added sections

### EOF in "text" mode

```c
...
else if (is_eof)
{
    INCOMPLETE_IMPLEMENTATION("parse error");
    dom_node_t* current = stack[stack_idx];
    if (current->name == html_tag_script())
    {
        INCOMPLETE_IMPLEMENTATION("set already_started to true");
    }

    stack_pop();
    consume = false;
    mode = original_mode;
}
...
```

### Overriding elements in formatting_elements array

```c
static void test_parser_35()
{
    // #data
    // <font><p>hello<b>cruel</font>world
    // #errors
    // (1,6): expected-doctype-but-got-start-tag
    // (1,29): adoption-agency-1.3
    // (1,29): adoption-agency-1.3
    // (1,34): expected-closing-tag-but-got-eof
    // #document
    // | <html>
    // |   <head>
    // |   <body>
    // |     <font>
    // |     <p>
    // |       <font>
    // |         "hello"
    // |         <b>
    // |           "cruel"
    // |       <b>
    // |         "world"

    unsigned char buffer[]  = "<font><p>hello<b>cruel</font>world";
    dom_node_t* expected    = dom_document_new();
    dom_node_t* html        = dom_element_new(expected, html_tag_html());
    dom_node_t* head        = dom_element_new(expected, html_tag_head());
    dom_node_t* body        = dom_element_new(expected, html_tag_body());
    dom_node_t* font1       = dom_element_new(expected, html_tag_font());
    dom_node_t* p1          = dom_element_new(expected, html_tag_p());
    dom_node_t* font2       = dom_element_new(expected, html_tag_font());
    dom_node_t* b1          = dom_element_new(expected, html_tag_b());
    dom_node_t* b2          = dom_element_new(expected, html_tag_b());
    dom_node_t* t1          = dom_text_new(expected, "hello", 5);
    dom_node_t* t2          = dom_text_new(expected, "cruel", 5);
    dom_node_t* t3          = dom_text_new(expected, "world", 5);

    APPEND_TO_TREE(expected, html);
    APPEND_TO_TREE(html, head);
    APPEND_TO_TREE(html, body);
    APPEND_TO_TREE(body, font1);
    APPEND_TO_TREE(body, p1);
    APPEND_TO_TREE(p1, font2);
    APPEND_TO_TREE(font2, t1);
    APPEND_TO_TREE(font2, b1);
    APPEND_TO_TREE(b1, t2);
    APPEND_TO_TREE(p1, b2);
    APPEND_TO_TREE(b2, t3);

    RUN_TEST_AND_ASSERT_DOCUMENT(buffer, expected);
}
```

The above test was producing the wrong tree

```c
--------------------Actual
# document
  html
    head
    body
      font
      p
        font
          #text - hello
          b
            #text - cruel
        #text - world

--------------------Expected
// #document
// | <html>
// |   <head>
// |   <body>
// |     <font>
// |     <p>
// |       <font>
// |         "hello"
// |         <b>
// |           "cruel"
// |       <b>
// |         "world"
```

The issue was that i was overriding elements in the `formatting_elements` array instead of inserting in it.

```diff
-remove_formatting_element(formatting_node);
-formatting_elements[bookmark] = new_element;
-formatting_elements_m[bookmark] = false;
-memcpy(&formatting_elements_t[bookmark], formatting_node_t, sizeof(html_token_t));
+insert_formatting_element(new_element, formatting_node_t, bookmark);
```

```diff
+static void insert_formatting_element(dom_node_t* node, html_token_t* token, uint32_t idx)
+{
+    for (uint32_t i = formatting_elements_size; i > idx; i--)
+    {
+        formatting_elements[i] = formatting_elements[i - 1];
+        formatting_elements_m[i] = formatting_elements_m[i - 1];
+        memcpy(&formatting_elements_t[i], &formatting_elements_t[i - 1], sizeof(html_token_t));
+    }
+
+    formatting_elements[idx] = node;
+    formatting_elements_m[idx] = false;
+    memcpy(&formatting_elements_t[idx], token, sizeof(html_token_t));
+    formatting_elements_size++;
+}
```

### Missing step from adoption agency procedure

```c
static void test_parser_49()
{
    // #data
    // <DIV> abc <B> def <I> ghi <P> jkl </B>
    // #errors
    // (1,5): expected-doctype-but-got-start-tag
    // (1,38): adoption-agency-1.3
    // (1,38): expected-closing-tag-but-got-eof
    // #document
    // | <html>
    // |   <head>
    // |   <body>
    // |     <div>
    // |       " abc "
    // |       <b>
    // |         " def "
    // |         <i>
    // |           " ghi "
    // |       <i>
    // |         <p>
    // |           <b>
    // |             " jkl "

    unsigned char buffer[]  = "<DIV> abc <B> def <I> ghi <P> jkl </B>";
    dom_node_t* expected    = dom_document_new();
    dom_node_t* html        = dom_element_new(expected, html_tag_html());
    dom_node_t* head        = dom_element_new(expected, html_tag_head());
    dom_node_t* body        = dom_element_new(expected, html_tag_body());
    dom_node_t* div         = dom_element_new(expected, html_tag_div());
    dom_node_t* t1          = dom_text_new(expected, " abc ", 5);
    dom_node_t* b1          = dom_element_new(expected, html_tag_b());
    dom_node_t* b2          = dom_element_new(expected, html_tag_b());
    dom_node_t* t2          = dom_text_new(expected, " def ", 5);
    dom_node_t* i1          = dom_element_new(expected, html_tag_i());
    dom_node_t* i2          = dom_element_new(expected, html_tag_i());
    dom_node_t* t3          = dom_text_new(expected, " ghi ", 5);
    dom_node_t* p1          = dom_element_new(expected, html_tag_p());
    dom_node_t* t4          = dom_text_new(expected, " jkl ", 5);

    APPEND_TO_TREE(expected, html);
    APPEND_TO_TREE(html, head);
    APPEND_TO_TREE(html, body);
    APPEND_TO_TREE(body, div);
    APPEND_TO_TREE(div, t1);
    APPEND_TO_TREE(div, b1);
    APPEND_TO_TREE(div, i2);
    APPEND_TO_TREE(b1, t2);
    APPEND_TO_TREE(b1, i1);
    APPEND_TO_TREE(i1, t3);
    APPEND_TO_TREE(i2, p1);
    APPEND_TO_TREE(p1, b2);
    APPEND_TO_TREE(b2, t4);

    RUN_TEST_AND_ASSERT_DOCUMENT(buffer, expected, false);
}
```

The resulting trees

```text
------------------------------- ACTUAL
# document
  html
    head
    body
      div
        #text -  abc
        b
          #text -  def
          i
            #text -  ghi
            p
              b
                #text -  jkl
        i
          p
            b
              #text -  jkl

-------------------------------- EXPECTED
// #data
// <DIV> abc <B> def <I> ghi <P> jkl </B>
// #errors
// (1,5): expected-doctype-but-got-start-tag
// (1,38): adoption-agency-1.3
// (1,38): expected-closing-tag-but-got-eof
// #document
// | <html>
// |   <head>
// |   <body>
// |     <div>
// |       " abc "
// |       <b>
// |         " def "
// |         <i>
// |           " ghi "
// |       <i>
// |         <p>
// |           <b>
// |             " jkl "
```

Basically it looked like nodes were getting duplicated, but it was just a matter of not removing old sibling information from the structs.

```diff
dom_node_t* dom_node_remove(dom_node_t* node, dom_node_t* child)
{
    ..

+    child->parent = NULL;
+    child->next = NULL;
+    child->prev = NULL;

    return child;
}
```

### Other new sections

I also added implementations for sections that were not complete.

- end < li > tag handling in "in body"
- end < hX > tag handling in "in body"
- start < image > tag in "in body"
- start < textarea > tag in "in body"
- frame related tag handling

One thing im noticing is that adding these tests manually is a hassle. I would like to add automated test runners for both the tokenizer and the tree-construction tests. This is what I will focus on for the next couple of sprints.

Martin