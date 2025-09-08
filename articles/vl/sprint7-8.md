# HTML Tree Construction - Part 4
_11.08.2025 - 07.09.2025_


> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

This is a small update related to the last two sprints. Sadly I didnt spend enough time on the project and mainly worked on the object model(?) for the dom tree.

Overall, I am not happy with how the time was spent. I wasted quite a few hours going back and forth between different (unfinished) possible implementations of the DOM tree and in the end I came back to the one i started with. I tried to fix problems I dont have using my incomplete understanding of the spec. After I realised that the refactor was pointless I decided to go back to the original implementation and not change it before I have a solid idea of how it will be used.

The current model is as follows

```c

typedef struct
{
    dom_node_type_e type;
    hash_str_t name;
    hash_str_t base_uri;

    struct dom_node_t* document;
    ... other fields

} dom_node_t;

```

Interfeces that also implement `dom_node_t` will now embed this struct.

```c
// https://dom.spec.whatwg.org/#element
typedef struct
{
    dom_node_t     node;

    hash_str_t      namespace;
    hash_str_t      prefix;
    hash_str_t      local_name;
    hash_str_t      tag_name;
    hash_str_t      id;
    hash_str_t      class_name;

} dom_element_t;
```

Which allows me to cast the pointer to w/e interface is needed.

```c
dom_element_t* dom_element_from_node(dom_node_t* node)
{
    assert(node->type == DOM_NODE_ELEMENT);

    return (dom_element_t*)node;
}


dom_node_t* dom_node_from_element(dom_element_t* element)
{
    return (dom_node_t*)element;
}
```

The only thing I do not like is that to free the structures I have to manually check the type and delegate the freeing of the memory to the appropriate parent function

```c
void dom_node_free(dom_node_t* node)
{
    dom_node_t* child = node->last;
    while (child)
    {
        dom_node_t* prev = child->prev;
        dom_node_free(child);
        child = prev;
    }

    if (node->type == HTML_NODE_ELEMENT)   { html_element_free(node); }
    if (node->type == DOM_NODE_DOCUMENT)   { dom_document_free(node); }
    if (node->type == DOM_NODE_DOCTYPE)    { dom_doctype_free(node); }
    if (node->type == DOM_NODE_ELEMENT)    { dom_element_free(node); }
    if (node->type == DOM_NODE_COMMENT)    { dom_comment_free(node); }
    if (node->type == DOM_NODE_TEXT)       { dom_text_free(node); }
}

```

I will continue using this model, once i have a full picture of what is needed i might try to refactor into something else.

Martin