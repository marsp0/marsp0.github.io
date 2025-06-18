# HTML Tokenization and Testing
_02.06.2025 - 15.06.2025_

> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

In the second sprint of the project, the focus was on completing the tokenizer implementation and adding corresponding tests. Similar to the previous sprint, the time spent on these tasks was less than originally planned due to external factors.

The three main work items for this sprint were:
- Finalizing the initial implementation of the tokenizer
- Writing and running tests to validate the tokenizer
- Adding error handling support to the tokenizer

## HTML tokenizer

The goal of the initial tokenizer implementation is to cover the majority of the functionality required by the spec, though not all of it. There are still parts I haven't figured out how to approach—named character references, for example. Rather than getting stuck on smaller or more complex pieces early on, I’ve added a backlog item for this and will revisit it once I’ve had more time to think it through.

There have been a few changes since the last sprint, including:
- Strings in tokens are now stored as bytes instead of code points.
- Tokenizer states are now exported, and the initial state can be manually set. Previously, the tokenizer always defaulted to `DATA_STATE`.

## Tests

After some research, I found a [repository](https://github.com/html5lib/html5lib-tests) containing a comprehensive set of tests for parser conformance. The tests are specified in JSON format and are relatively straightforward to understand. Since I don’t have a JSON parser implemented yet, I’m going through the tests manually, converting each one into C code—similar to the example below.

```c

static void hexadecimal_entity_pair_representing_surrogate_pair()
{
    // {"description":"Hexadecimal entity pair representing a surrogate pair",
    // "input":"&#xD869;&#xDED6;",
    // "output":[["Character", "\uFFFD\uFFFD"]],
    // "errors":[
    //     { "code": "surrogate-character-reference", "line": 1, "col": 9 },
    //     { "code": "surrogate-character-reference", "line": 1, "col": 17 }
    // ]},

    html_token_t tokens[SIZE_TEN] = { 0 };

    const char buffer[] = "&#xD869;&#xDED6;";
    const uint32_t buffer_size = sizeof(buffer) - 1;
    html_tokenizer_init(buffer, buffer_size, tokens, SIZE_TEN);

    for (uint32_t i = 0; i < SIZE_TEN; i++) { ASSERT_FALSE(tokens[i].is_valid); }

    uint32_t return_sizes[]         = { 1, 1, 1 };
    html_tokenizer_error_e errors[] = { HTML_TOKENIZER_SURROGATE_CHARACTER_REFERENCE,
                                        HTML_TOKENIZER_SURROGATE_CHARACTER_REFERENCE,
                                        HTML_TOKENIZER_OK };

    html_token_t tokens_e[][1] = { { {.is_valid = true, .type = HTML_CHARACTER_TOKEN, .data_size = 3, .data = { [0] = 0xef, [1] = 0xbf, [2] = 0xbd } } },
                                   { {.is_valid = true, .type = HTML_CHARACTER_TOKEN, .data_size = 3, .data = { [0] = 0xef, [1] = 0xbf, [2] = 0xbd } } },
                                   { {.is_valid = true, .type = HTML_EOF_TOKEN } } };

    uint32_t return_sizes_len = sizeof(return_sizes) / sizeof(uint32_t);
    uint32_t errors_len = sizeof(errors) / sizeof(html_tokenizer_error_e);
    uint32_t tokens_e_len = sizeof(tokens_e) / sizeof(html_token_t) / 1;
    ASSERT_EQUAL(return_sizes_len, errors_len);
    ASSERT_EQUAL(tokens_e_len, errors_len);

    uint32_t tests = sizeof(return_sizes) / sizeof(uint32_t);
    for (uint32_t i = 0; i < tests; i++)
    {
        uint32_t size_e = return_sizes[i];
        html_tokenizer_error_e err_e    = errors[i];
        html_tokenizer_error_e err_a    = html_tokenizer_next();

        ASSERT_TOKENS_SIZE(size_e, SIZE_TEN);
        ASSERT_EQUAL(err_a, err_e);

        for (uint32_t j = 0; j < size_e; j++)
        {
            html_token_t token_e = tokens_e[i][j];
            if (!token_e.is_valid) { continue; }
            ASSERT_TOKEN(tokens[j], token_e);
        }
    }
}

```

There are some hardcoded values in my current setup, and a few differences between my test implementation and the test repository:

- The test suite coalesces character tokens into a single token.
- Doctype tokens include a `correctness` attribute, which corresponds to the inverse of the `force_quirks` attribute defined in the spec.

Despite these differences, the test cases have already helped me uncover and fix several bugs in the implementation, so it’s great that this repository exists. The tokenizer section alone includes a large number of tests, and I’ve only converted a small portion so far.

## Tokenizer error support

One of the things I chose to leave out of the initial implementation was tokenizer error handling. At the time, I wasn’t entirely sure how it should work, so I decided to postpone it. However, as I’ve started working through the test cases, I now have a clearer understanding and have begun incorporating error handling into the tokenizer. There’s still more work to be done, but I’m confident that by the time all the tests are converted, this part of the implementation will be complete.

The focus of sprint 3 will be more tests, error support and bugs.
