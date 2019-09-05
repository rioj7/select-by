# Select By
Select part of the file content surrounding the selection based on Regular Expressions. The current selection is extended by searching forward and or backward. If there is no current selection the cursor position is used.

You can specify a "Search Back" expression and a "Search Forward" expression. If they are not specified that search direction is not performed.

So you can extend the selection

* from the selection end (or cursor) to the next occurrence of a Regular Expression or end of the file
* from the selection start (or cursor) search back for a Regular Expression or start of the file
* or combine both searches

You can specify up to 5 ranges specified by Regular Expressions that can be linked to keyboard shortcuts.

The ranges are specified in the `settings.json` file for entry `selectby.regexes`.

* the 5 ranges have the keys: `regex1`, `regex2`, `regex3`, `regex4`, `regex5`
* the parameters for each range are
    * `flags`: a string with the regex flags "i" and/or "m" (default: "")
    * `backward`: the regular expression to search from the selection start (or cursor) to the start of the file. If you want to select to the file start, construct a regex that will never be found. If this parameter is not present the selection start is not modified or starts at the cursor position.
    * `forward`:  the regular expression to search for from the selection end (or cursor) to the end of the file. If you want to select to the file end, construct a regex that will never be found. If this parameter is not present the selection end is not modified or ends at the cursor position.
    * `backwardInclude`: should the matched **backward** search text be part of the selection (default: true)
    * `forwardInclude`: should the matched **forward** search text be part of the selection (default: true)
    * `copyToClipboard`: copy the selection to the clipboard (default: false)
    * `hideSelectionAfterCopy`: hides the copied selection in the editor, and keeps the cursor at its current location. Only works if `copyToClipboard` is true. (default: false)

If newline characters are part of the regular expression you can determine if it is part of the selection (see example `regex2`).

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
        "backward": "%% section(\\r?\\n)?",
        "forward": "%% section",
        "forwardInclude": false,
        "backwardInclude": false,
        "copyToClipboard": true
      }
    }
```

## TODO
Support for Multi Cursors

## Known Issues
The workspace/folder setting does not always override the global user setting
