The extension has commands for 2 things:

* [Select By](#select-by): modify the selection based on Regular Expressions
* [Move By](#move-by): move the cursor based on Regular Expressions

# Select By
Select part of the file content surrounding the selection based on Regular Expressions. The current selection is extended by searching forward and or backward or forward twice. If there is no current selection the cursor position is used.

You can specify a "Search Back" expression, a "Search Forward" expression and  a "Search Forward Next" expression. If they are not specified that search direction is not performed.

So you can extend the selection

* Forward: from the selection end (or cursor) to the next occurrence of a Regular Expression or end of the file
* Backward: from the selection start (or cursor) search back for a Regular Expression or start of the file
* ForwardNext: from the end of the Forward search, search for a different Regular Expression in the Forward direction. You can reuse captured groups from the forward Regular Expression.
* or combine Forward and Backward
* or combine Forward and ForwardNext

You can specify any number of ranges specified by Regular Expressions that can be linked to keyboard shortcuts. A range can have any name.

The extension exports 5 commands that use a fixed name: `selectby.regex1` to `selectby.regex5` use the respective range names: `regex1`, `regex2`, `regex3`, `regex4`, `regex5`.

The ranges are specified in the `settings.json` file for entry `selectby.regexes`.

* the key for the range can have any name
* the parameters for each range are
    * `flags`: a string with the regex flags "i" and/or "m" (default: "")
    * `backward`: the regular expression to search from the selection start (or cursor) to the start of the file. If you want to select to the file start, construct a regex that will never be found. If this parameter is not present the selection start is not modified or starts at the cursor position. Or `false` if you want to override User setting.
    * `forward`: the regular expression to search for from the selection end (or cursor) to the end of the file. If you want to select to the file end, construct a regex that will never be found. If this parameter is not present the selection end is not modified or ends at the cursor position. Or `false` if you want to override User setting.
    * `forwardNext`: the regular expression to search for starting at the end of the **forward** search to the end of the file. Or false (to override User setting). See explanation.
    * `backwardInclude`: should the matched **backward** search text be part of the selection (default: true)
    * `forwardInclude`: should the matched **forward** search text be part of the selection (default: true)
    * `forwardNextInclude`: should the matched **forwardNext** search text be part of the selection (default: true)
    * `copyToClipboard`: copy the selection to the clipboard (default: false)
    * `showSelection`: modify the selection to include the new searched positions. Useful if `copyToClipboard` is true. (default: true)
    * `debugNotify`: show a notify message of the used search properties (User and Workspace properties are merged) (default: false)
    * `moveby`: the regular expression to search for. Used only by Move By

If newline characters are part of the regular expression you can determine if it is part of the selection (see example `SectionContent`).

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
      "SectionContent": {
        "backward": "%% section(\\r?\\n)?",
        "forward": "%% section",
        "forwardInclude": false,
        "backwardInclude": false,
        "copyToClipboard": true
      }
    }
```

## Select By with keybindings

It could be handy to have a search for a Regular Expression bound to a keyboard shortcut.

The command `selectby.regex` uses arguments to determine the regex range to use. You specify the arguments in a keybinding. At the moment only one argument is used, the name of the range.

You need to create 1 or more [key bindings in `keybindings.json`](https://code.visualstudio.com/docs/getstarted/keybindings).

```json
  {
    "key": "ctrl+shift+alt+f9",
    "when": "editorTextFocus",
    "command": "selectby.regex",
    "args": ["SectionContent"]
  }
```

## Select By with ForwardNext

By using the **forward** and **forwardNext** Regular Expressions you can modify the selection from the current selection end, or cursor position, by searching first for the **forward** Regular Expression and from that location search again for a Regular Expression to determine the end of the new selection.

It does not make sense to specify the **backward** Regular Expression. It has no effect on the result.

It is possible in the **forwardNext** Regular Expression to use captured groups `()` from the **forward** Regular Expression. It uses a special syntax to fill in the captured groups. Use `{{n}}` to use captured group `n` from the **forward** Regular Expression. To use captured group 1 you use `{{1}}`.

### An example: Select the next string content

In python you can specify 4 types of string literals.

Put this in your `settings.json` file:

```json
    "selectby.regexes": {
      "stringContent": {
        "forward": "('''|\"\"\"|'|\")",
        "forwardNext": "{{1}}",
        "forwardInclude": false,
        "forwardNextInclude": false
      }
    }
```
Define a keybinding:

```json
  {
    "key": "ctrl+shift+alt+f10",
    "when": "editorTextFocus",
    "command": "selectby.regex",
    "args": ["stringContent"]
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

You can move the cursor based on Regular Expressions.

The exported command is: `moveby.regex`

Move By uses the regex definitions as defined for Select By.

To use Move By you need to create 1 or more [key bindings in `keybindings.json`](https://code.visualstudio.com/docs/getstarted/keybindings).

If called from the Command Palette nothing happens.

The details of the search are specified in the `"args"` property of the key binding. It is an array of 4 strings. You must specify all 4, there are no default values:
* index 0: the key/name of the range you want to use as defined in the settings option `selectby.regexes`
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
    "args": ["SectionContent", "forward", "prev", "start"]
  }
```

## Move to previous and next empty line

Created by [Arturo Dent](https://github.com/rioj7/select-by/issues/7) and it needed a small code change to work because the regex matches an empty string.

Add the following to `selectby.regexes`

```json
    "goToEmptyLine": {
      "flags": "m",
      "moveby": "^$"
    }
```

Define 2 key bindings (you can change the assigned keys)
```json
  {
    "key": "ctrl+shift+f7",
    "when": "editorTextFocus",
    "command": "moveby.regex",
    "args": ["goToEmptyLine", "moveby", "prev", "start"]
  },
  {
    "key": "ctrl+shift+f8",
    "when": "editorTextFocus",
    "command": "moveby.regex",
    "args": ["goToEmptyLine", "moveby", "next", "start"]
  }
```

# TODO

* Support for Multi Cursors
* Move By called from Command Palette, Enter/Select options and remember RegExes for this section of VSC
* Select By called from Command Palette, use QuickPick to choose a defined range.
