# CSS Tokenizer v1
_17.11.2025 - 30.11.2025_

> Disclaimer: Please take everything I write here with a grain of salt—I'm by no means an expert. Some of these concepts I'm encountering for the first time, and my understanding might have significant gaps—and that's okay. It's one of the reasons I decided to take on this project. If you see anything wrong, let me know and I'll fix it.

The focus for this sprint was on an initial implementation of the css tokenizer that can be tested.

## CSS Tokenizer

The tokenizer uses a series of `consume_*` algorithms and checks to process the input buffer.

- `consume_token`
- `consume_comment`
- `consume_numeric_token`
- `consume_ident_token`
- `consume_string`
- `consume_url_token`
- `consume_escaped_code_point`
- `consume_number`
- `consume_bad_url`
- `convert_string_to_number`
- `is_valid_escape` - checks if two code points are valid escape character
- `is_ident_start` - checks if three code points start an ident sequence
- `is_number_start` - checks if three code points start a number

The good thing about the above is that each `consume_*` algorithm is self-contained and returns a single token. Each call to `css_tokenizer_next()` therefore returns exactly one token, unlike the HTML tokenizer, which can return multiple tokens.

One drawback is that all of these algorithms can consume a code point and advance the cursor on their own. In contrast, the HTML tokenizer advances the cursor at a single call site, which I prefer.

## Tests

Thankfully I was able to find a repo with tests that i can use - [css-tokenizer-tests](https://github.com/romainmenke/css-tokenizer-tests). Using a translation script (similar to the ones used for the HTML tokenizer and parser) I was able to convert the tests to a familiar line based format.

The repo is divided into categories, each category has a folder for each test, each folder contains a file for the input buffer and another json file for the expected tokens.

Example: `ident/0003`

`source.css`
```
--0

```

`tokens`
```json
[
	{
		"type": "ident-token",
		"raw": "--0",
		"startIndex": 0,
		"endIndex": 3,
		"structured": {
			"value": "--0"
		}
	},
	{
		"type": "whitespace-token",
		"raw": "\n",
		"startIndex": 3,
		"endIndex": 4,
		"structured": null
	}
]
```

ident.txt
```
#data-0003
--0\n
#token-type
ident-token
#token-value
--0
#token-type
whitespace-token
#end-test
```

As you can see the translation only uses the `type` and `structured` fields, the rest are ignored.

As with the other translation scripts, there are some unsupported tests
```json
[
    ["dimension", "0008", "null byte"],
    ["fuzz", "b69ece36-057f-4450-9423-a1661787bce6", "null bytes"],
    ["fuzz", "4f865903-e4dd-4a0b-83ed-e630cfa9dcca", "null bytes"],
    ["fuzz", "5181013c-60ab-483b-9c06-fb32c7e1e7e8", "null bytes"],
    ["fuzz", "4e630a47-507b-4b79-b00f-57f7dc1cc79d", "null bytes"],
    ["fuzz", "6d07fc79-586f-4efa-a0a2-37d4dd3beb09", "null bytes"],
    ["fuzz", "864d7812-b82f-47c2-94e4-8402ba6ba94a", "null bytes"],
    ["fuzz", "2abe9406-c063-4e9a-85ac-b13660671553", "long string"],
    ["fuzz", "7f49c8fc-8292-4a3e-828b-b5d028a80d5f", "long string"],
    ["url", "0010", "long string"],
    ["url", "0009", "long string"]
]
```

Tests status as of this post:

|Test|# of supported|
|-|-|
|at-keyword|9/9|
|bad-string|5/5|
|bad-url|8/8|
|colon|1/1|
|comma|1/1|
|comment|6/6|
|digit|1/1|
|dimension|7/8|
|escaped-code-point|16/16|
|full-stop|3/3|
|fuzz|4/12|
|hash|0/15|
|hyphen-minus|6/6|
|ident-like|9/9|
|ident|9/9|
|left-curly-bracket|1/1|
|left-parenthesis|1/1|
|left-square-bracket|1/1|
|less-than|4/4|
|number|20/20|
|numeric|4/4|
|plus|4/4|
|right-curly-bracket|1/1|
|right-parenthesis|1/1|
|right-square-bracket|1/1|
|semi-colon|1/1|
|string|9/9|
|url|13/15|
|whitespace|8/8|

For next sprint I will try to convert the tokenizer to use iterative approach similar to the one used by the HTML tokenizer as I like it more.

Martin