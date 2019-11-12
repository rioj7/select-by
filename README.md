The extension has commands for 2 things:

* Select By: modify the selection based on Regular Expressions
* Move By: move the cursor based on Regular Expressions

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
    * `backward`: the regular expression to search from the selection start (or cursor) to the start of the file. If you want to select to the file start, construct a regex that will never be found. If this parameter is not present the selection start is not modified or starts at the cursor position. Or `false` if you want to override User setting.
    * `forward`: the regular expression to search for from the selection end (or cursor) to the end of the file. If you want to select to the file end, construct a regex that will never be found. If this parameter is not present the selection end is not modified or ends at the cursor position. Or `false` if you want to override User setting.
    * `backwardInclude`: should the matched **backward** search text be part of the selection (default: true)
    * `forwardInclude`: should the matched **forward** search text be part of the selection (default: true)
    * `copyToClipboard`: copy the selection to the clipboard (default: false)
    * `showSelection`: modify the selection to include the new searched positions. Useful if `copyToClipboard` is true. (default: true)
    * `debugNotify`: show a notify message of the used search properties (User and Workspace properties are merged) (default: false)
    * `moveby`: the regular expression to search for. Used only by Move By

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
## User and Workspace settings
The Workspace/folder setting does override the global User setting. The settings are deep-merged.

If you have defined this User setting:

```json
    "selectby.regexes": {
      "regex1": {
        "flags": "i",
        "backward": "%% article",
        "forward": "%% article",
        "backwardInclude": true,
        "forwardInclude": false
      }
    }
```

And this Workspace setting:

```json
    "selectby.regexes": {
      "regex1": {
        "flags": "i",
        "forward": "%% section",
        "forwardInclude": false
      }
    }
```

There will be still a search done backward for: `%% article`. The extension does not know which file has defined a particular setting. You have to disable the backward search in the Workspace setting:

```json
    "selectby.regexes": {
      "regex1": {
        "flags": "i",
        "forward": "%% section",
        "forwardInclude": false,
        "backward: false
      }
    }
```

# Move By

It could be handy to have a search for a Regular Expression bound to a keyboard shortcut.

The exported command is: `moveby.regex`

Move By uses the regex definitions as defined for Select By.

To use Move By you need to create 1 or more [key bindings in `keybindings.json`](https://code.visualstudio.com/docs/getstarted/keybindings).

If called from the Command Palette nothing happens.

The details of the search are specified in the `"args"` property of the key binding. It is an array of 4 strings. You must specify all 4, there are no default values:
* index 0: the regex you want to use as defined in the settings option `selectby.regexes`. You can use `"regex1"` to `"regex99"`
* index 1: `"forward"` | `"backward"` | `"moveby"` - which regex string should be used
* index 2: `"prev"` | `"next"` - search direction - do you want to search for the **previous** or **next** occurrence of the Regular Expression
* index 3: `"start"` | `"end"` - should the cursor move to the **start** or the **end** of the found Regular Expression

To use regular expressions that are not used in selections you can use the `"moveby"` property of the `selectby.regexes` elements or you can duplicate the `"forward"` or `"backward"` field. This property is just added to prevent confusion in the specification of `"args"` (`"forward"` does not mean to search in the forward direction)

If the Regular Expression is not found the cursor will not change. If there was a text selection the selection is removed and the cursor changes to the start or end of the selection depending on the direction of the search.

With the setting `"moveby.revealType"` you can change the behavior of how the cursor should be revealed after the move. In the Settings UI, group **Extensions** | **Select By**, it is a dropdown box with possible values. These strings are identical to the VSC API enum [TextEditorRevealType](https://code.visualstudio.com/api/references/vscode-api#TextEditorRevealType).

You can create a key binding with the UI of VSC but you have to add the `"args"` property by modifying `keybindings.json`. If you do not define the `"args"` property nothing happens if you press the key binding.

An example key binding:

```json
  {
    "key": "ctrl+shift+alt+s",
    "when": "editorTextFocus",
    "command": "moveby.regex",
    "args": ["regex3", "forward", "prev", "start"]
  }
```

# TODO

* Support for Multi Cursors
* Move By called from Command Palette, Enter/Select options and remember RegExes for this section of VSC
