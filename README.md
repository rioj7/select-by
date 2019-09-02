# Select By
Select part of the file content surrounding the cursor position based on Regular Expressions.

You can specify a "Search Back" expression, a "Search Forward" expression. If they are not specified that search direction is not performed.

So you can select

* starting from the cursor till the next occurrence of a Regular Expression or end of file
* search back for a Regular Expression or begin of file and select up to the cursor
* or combine both searches

You can specify up to 5 ranges specified by Regular Expressions that can be linked to keyboard shortcuts.

The ranges are specified in the `settings.json` file for entry `selectby.regexes`.

* the 5 ranges have the keys: `regex1`, `regex2`, `regex3`, `regex4`, `regex5`
* the parameters for each range are
    * `flags`: a string with the regex flags "i" and/or "m" (default: "")
    * `backward`: the regular expression to search from the cursor to the begin of the file. If not present the selection **starts** at the cursor position. If you want to select to the file begin, construct a regex that will never be found.
    * `forward`:  the regular expression to search from the cursor to the end of the file. If not present the selection **ends** at the cursor position. If you want to select to the file end, construct a regex that will never be found.
    * `backwardInclude`: should the matched **backward** search text be part of the selection (default: true)
    * `forwardInclude`: should the matched **forward** search text be part of the selection (default: true)

If the newline characters are part of the regular expression you can control if it is part of the selection (see example `regex2`).

## An example

```json
    "selectby.regexes": {
      "regex1": {
        "flags": "i",
        "backward": "%% section",
        "forward": "%% section",
        "backwardInclude": true,
        "forwardInclude": false
      },
      "regex2": {
        "backward": "%% section[\\n\\r]+",
        "forward": "%% section",
        "forwardInclude": false,
        "backwardInclude": false
      }
    }
```

## TODO
Support for Multi Cursors
