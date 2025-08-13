# HTML Tree Construction - Part 3
_28.07.2025 - 10.08.2025_


> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

This sprint was more of the same, adding tests and missing implementations.

- Active formatting elements logic
- "Element in scope" logic
- Adoption agency logic
- The weird case of `test_parser_8`

## Active formatting elements

Spec: [The list of active formatting elements](https://html.spec.whatwg.org/multipage/parsing.html#the-list-of-active-formatting-elements)

The specification defines a “list of active formatting elements,” which is essentially a secondary stack used to manage misnested formatting elements. This stack can hold two kinds of entries: standard `html_node_t` elements, and special entries called `markers`. Markers are placed for certain HTML elements and act as boundaries, preventing formatting from “leaking” beyond their intended scope.

### Assumptions and implementation

As of right now the stack can contain a maximum of 10 elements. The number was chosen at random and I'll change it when it isnt enough. The data structures are as follows

```c
static html_node_t* formatting_elements[10]         = { 0 };            // holds actual nodes
static bool formatting_elements_m[10]               = { 0 };            // holds markers
static html_token_t formatting_elements_t[10]       = { 0 };            // holds tokens
static uint32_t formatting_elements_size            = 0;
```

From the perspective of the parser, `formatting_elements` and `formatting_elements_m` are a single array. `formatting_elements_t` holds the tokens for which the formatting elements were created. The structure is needed because the parser does not keep the tokens around after they have been processed.

The spec also defines some operations 

- [push element/marker onto stack](https://html.spec.whatwg.org/multipage/parsing.html#push-onto-the-list-of-active-formatting-elements) - adds nodes to the appropriate list and updates the size
- [reconstruction of active formatting elements](https://html.spec.whatwg.org/multipage/parsing.html#reconstruct-the-active-formatting-elements) - this is what reopens closed (removed from stack of open elements) elements in the order in which they were opened. Basically, handling misnested formatting tags boils down to duplicating them.
- [clear until last marker](https://html.spec.whatwg.org/multipage/parsing.html#clear-the-list-of-active-formatting-elements-up-to-the-last-marker)

An example of a buffer that contains misnested tags is the following

`<p>1<b>2<i>3</b>4</i>5</p>`


## "Element in scope" logic

Spec: [Element in scope](https://html.spec.whatwg.org/multipage/parsing.html#has-an-element-in-the-specific-scope)

This is another mechanism for maintaining the structure of an HTML document. One way it does that is by preventing nonsensical nesting—for example, placing a `button` inside another `button`. It also protects us from running logic based on assumptions about the DOM that might not actually hold. For instance, when we encounter an end tag for the `body` element, the spec calls for certain steps to run. But if there was never a `body` start tag, there’s no body element to operate on. By checking whether the body element is “in scope,” we can decide whether to run those steps or skip them. There are several types of scope, but the underlying code is fairly straightforward.

```c
static bool in_scope(unsigned char* name, uint32_t name_size, html_element_scope_e scope)
{
    html_node_t* node = stack[stack_idx];
    html_element_t* element = (html_element_t*)node->data;
    int32_t i = (int32_t)stack_idx;

    while (i >= 0)
    {
        const unsigned char* local_name = element->local_name;

        if (strncmp(name, local_name, name_size) == 0) { return true; }

        if (strncmp(HTML, local_name, HTML_SIZE) == 0       ||
            strncmp(TABLE, local_name, TABLE_SIZE) == 0     ||
            strncmp(TEMPLATE, local_name, TEMPLATE_SIZE) == 0)
        {
            return false;
        }

        if ((scope != TABLE_SCOPE) && (strncmp(APPLET, local_name, APPLET_SIZE) == 0   ||
                                       strncmp(CAPTION, local_name, CAPTION_SIZE) == 0 ||
                                       strncmp(TD, local_name, TD_SIZE) == 0           ||
                                       strncmp(TH, local_name, TH_SIZE) == 0           ||
                                       strncmp(MARQUEE, local_name, MARQUEE_SIZE) == 0 ||
                                       strncmp(OBJECT, local_name, OBJECT_SIZE) == 0))
        {
            return false;
        }

        if (scope == BUTTON_SCOPE && strncmp(BUTTON, element->local_name, BUTTON_SIZE) == 0)
        {
            return false;
        }

        i--;
        node = stack[i];
        element = (html_element_t*)node->data;
    }

    return false;
}
```

Don't worry about the calls to `strncmp`, it will be replaced with another utility function at the end.


## Adoption agency logic

Spec: [Adoption agency algorithm](https://html.spec.whatwg.org/multipage/parsing.html#adoption-agency-algorithm)

This is yet another mechanism used to fix misnested content. This is the most involved one as it can move children around. In contrast, the reconstruction of active elements works under the current node (w/e it is). The scope checks only tell you if an element is in scope, the logic that actually does anything else is different depending on the token and its not part of the scope check itself.

This is yet another mechanism for fixing misnested content, and it’s the most involved one because it can actually move child nodes around. By contrast, reconstruction of active formatting elements only operates under the current node, whatever that may be. Scope checks, on the other hand, simply tell you whether an element is in scope—they don’t modify the DOM directly. Any additional actions depend on the specific token being processed, and those steps are separate from the scope check itself.

This algorithm attempts to rehome nodes in a unified, consistent way. I haven’t fully tested my implementation yet, so I’m not including the code here.


## The curious test of `test_parser_8`

As im adding more tests from the html5lib-tests repo i gave up on naming and i started just using numbers. `test_parser_8` is one of the tests i used to check my `adoption agency algorithm` logic. Here it is

```c
// #data
    // <select><b><option><select><option></b></select>X
    // #errors
    // (1,8): expected-doctype-but-got-start-tag
    // (1,11): unexpected-start-tag-in-select
    // (1,27): unexpected-select-in-select
    // (1,39): unexpected-end-tag
    // (1,48): unexpected-end-tag
    // #document
    // | <html>
    // |   <head>
    // |   <body>
    // |     <select>
    // |       <option>
    // |     <option>
    // |       "X"

    unsigned char buffer[] = "<select><b><option><select><option></b></select>X";
    html_node_t* document   = html_document_new();
    html_node_t* html       = html_element_new(document, "html", 4);
    html_node_t* head       = html_element_new(document, "head", 4);
    html_node_t* body       = html_element_new(document, "body", 4);
    html_node_t* select     = html_element_new(document, "select", 6);
    html_node_t* o1         = html_element_new(document, "option", 6);
    html_node_t* o2         = html_element_new(document, "option", 6);
    html_node_t* t          = html_text_new(document, "X", 1);

    APPEND_TO_TREE(document, html);
    APPEND_TO_TREE(html, head);
    APPEND_TO_TREE(html, body);
    APPEND_TO_TREE(body, select);
    APPEND_TO_TREE(select, o1);
    APPEND_TO_TREE(body, o2);
    APPEND_TO_TREE(o2, t);

    RUN_TEST_AND_ASSERT_DOCUMENT(buffer, document);
```

The actual tree i was getting was completely different, namely

```
#document
| <html>
|   <head>
|   <body>
|     <select>
|       <b>
|         <option>
|     <b>
|       <option>
|     "X"
```

This was completely different from what the test expectations showed—the `text` node had ended up under the `body` element, and there were two extra `b` elements. I was sure my implementation was wrong. No joke, I spent 20–25 hours banging my head against the wall, comparing every executed line to the spec, trying to see where I’d gone wrong. I was so stuck that I even started wondering if browsers had custom handling for misnested `b` tags inside `select` elements.

To test that theory, I dug into the [Ladybird](https://github.com/LadybirdBrowser/ladybird) browser code—huge props to them for making it so readable—and saw that their `select` handling is a bit different. They have a parser mode called `IN_SELECT` (which I also have… but wasn’t using). Back to the spec I went—only to discover that `IN_SELECT` isn’t mentioned there anymore. A quick scan of recently merged PRs revealed the [cuplrit](https://github.com/whatwg/html/pull/10548). A PR that changes the logic related to parsing `select` tags.

At this point, I started thinking maybe the bug wasn’t in my code after all. When I checked the test expectations again, they were unchanged—but I also found an [open PR](https://github.com/html5lib/html5lib-tests/pull/178) that talks about the spec change and updates the exact test I was working on, the new expectations match exactly my output. That was a **gooooooooood** feeling.

Lesson learned: don’t wait until the last moment to check for recent spec changes—especially when working with a **living** standard.

This is it for sprint 6, next one is more of the same.

Martin
