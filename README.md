The extension has commands for 8 things:

* [Select By](#select-by): modify the selections based on Regular Expressions
* [Select By Paste Clipboard](#select-by-paste-clipboard): Replace selection with clipboard content
* [Select By Line Number](#select-by-line-number): Place cursor based on line number, uses boolean expression
* [Select By Remove Cursor](#select-by-remove-cursor): Remove one of the multi cursors
* `selectby.swapActive` : Swap anchor and active (cursor) positions of selection(s)
* `selectby.anchorAndActiveSeparate` : Create separate cursors for anchor and active position of the selection(s)
* [Select By Anchor and Active by Regex](#select-by-anchor-and-active-by-regex): Modify the anchor and active position of the selection(s)
* [Select By Mark](#select-by-mark): Mark position of cursor(s), create selection(s) on next mark, restore cursor locations
* [Select By Multi Cursor with keyboard](#select-by-multi-cursor-with-keyboard): Create and modify Multi Cursors with the keyboard
* [Select By Move Selections](#select-by-move-selections): Move selections start/end/anchor/active a given offset
* [Select By Add Selection To Next Find Match Multi Cursor](#select-by-add-selection-to-next-find-match-multi-cursor): Multi Cursor variant of **Add Selection To Next Find Match** (`Ctrl+D`)
* [Move By](#move-by): move the cursor based on Regular Expressions or a Calculation

# Select By

The command is **SelectBy: Select text range based on regex** (`selectby.regex`).

Select part of the file content surrounding the selection based on Regular Expressions. The current selection is extended or shrunk by searching forward and or backward or forward twice. If there is no current selection the cursor position is used.

`selectby.regex` supports Multi Cursor. Each selection is processed separately.

You can specify a "Search Back" expression, a "Search Forward" expression and  a "Search Forward Next" expression. If they are not specified that search direction is not performed.

You can extend a side of the selection:

* Forward: from the selection end (or cursor) to the next occurrence of a Regular Expression or end of the file
* Backward: from the selection start (or cursor) search back for a Regular Expression or start of the file
* ForwardNext: from the end of the Forward search, search for a different Regular Expression in the Forward direction. You can reuse captured groups from the forward Regular Expression.
* ForwardNextExtendSelection: if the Forward Regular Expression matches at the start of the selection the ForwardNext Regular Expression extends the selection. Otherwise a normal ForwardNext search.
* or combine Forward and Backward
* or combine Forward and ForwardNext

You can shrink a side of the selection:

* from the selection start (or cursor) to the next occurrence of the Backward Regular Expression or end of the file. Set `backwardShrink` to true.
* from the selection end (or cursor) to the previous occurrence of the Forward Regular Expression or start of the file. Set `forwardShrink` to true.

You can shrink one side of the selection and expand the other side of the selection.

You can specify any number of ranges specified by Regular Expressions that can be linked to keyboard shortcuts. A range can have any name.

The extension exports 5 commands that use a fixed name: `selectby.regex1` to `selectby.regex5` use the respective range names: `regex1`, `regex2`, `regex3`, `regex4`, `regex5`.

The ranges are specified in the `settings.json` file for entry `selectby.regexes`.

* the key for the range can have any name
* the parameters for each range are
    * `flags`: a string with the regex flags "i" and/or "m" (default: "")
    * `backward`: the regular expression to search from the selection start (or cursor) to the start of the file. If you want to select to the file start, construct a regex that will never be found. If this parameter is not present the selection start is not modified or starts at the cursor position. Or `false` if you want to override User setting.
    * `forward`: the regular expression to search for from the selection end (or cursor) to the end of the file. If you want to select to the file end, construct a regex that will never be found. If this parameter is not present the selection end is not modified or ends at the cursor position. Or `false` if you want to override User setting.
    * `forwardNext`: the regular expression to search for starting at the end of the **forward** search to the end of the file. Or `false` (to override User setting). [See explanation](#select-by-with-forwardnext).
    * `backwardInclude`: should the matched **backward** search text be part of the selection (default: `true`)
    * `forwardInclude`: should the matched **forward** search text be part of the selection (default: `true`)
    * `backwardShrink`: do we reduce (shrink) at the current selection start. Find next `backward` regular expression relative to selection start (default: `false`)
    * `forwardShrink`: do we reduce (shrink) at the current selection end. Find previous `forward` regular expression relative to selection end (default: `false`)
    * `backwardAllowCurrentPosition`: is the current selection start an allowed backward position (default: `true`)
    * `forwardAllowCurrentPosition`: is the current selection end an allowed forward position (default: `true`)
    * `forwardNextInclude`: should the matched **forwardNext** search text be part of the selection (default: `true`)
    * `forwardNextExtendSelection`: should we extend the selection with the matched **forwardNext** search text if the begin of the selection matches the **forward** regex (default: `false`). [See explanation](#select-by-with-forwardnextextendselection).
    * `surround` : select the text around the current selection that matches the regular expression, the selection is somewhere in the text to select, or false (to override User setting). [See explanation](#select-by-with-surround).
    * `copyToClipboard`: copy the selection to the clipboard (default: `false`)
    * `showSelection`: modify the selection to include the new searched positions. Useful if `copyToClipboard` is `true`. (default: `true`)
    * `debugNotify`: show a notify message of the used search properties (User and Workspace properties are merged) (default: `false`)
    * `moveby`: the regular expression to search for. Used only by [Move By](#move-by)
    * `label`, `description`, `detail`: when SelectBy is called from the command palette it shows a QuickPick list. These 3 properties (`strings`) are used in the construction of the [QuickPickItem](https://code.visualstudio.com/api/references/vscode-api#QuickPickItem). The default value for `label` is the key name of the range. The label is decorated with additional icons in case the range contains the parameters `copyToClipboard` or `debugNotify`. In the 3 properties you can [use other icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html) with the `$(<name>)`-syntax.

If newline characters are part of the regular expression you can determine if it is part of the selection (see example [`SectionContent`](#an-example)).

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

You create [key bindings in `keybindings.json`](https://code.visualstudio.com/docs/getstarted/keybindings).

If the definition of the search is found in the setting `selectby.regexes` you can specify the name of the search in an array:

```json
  {
    "key": "ctrl+shift+alt+f9",
    "when": "editorTextFocus",
    "command": "selectby.regex",
    "args": ["SectionContent"]
  }
```

You can also define the range of the search in the args property by using an object:

```json
  {
    "key": "ctrl+shift+alt+f9",
    "when": "editorTextFocus",
    "command": "selectby.regex",
    "args": {
      "backward": "%% section(\\r?\\n)?",
      "forward": "%% section",
      "forwardInclude": false,
      "backwardInclude": false,
      "copyToClipboard": true
    }
  }
```

If you create a keybinding without an `args` property a QuickPick list, with recently used items, will be shown where you can select a range to use.

## Select By with backward/forwardAllowCurrentPosition

If the current selection start or end is a valid position for the given search regex the selection will not be extended if you have the `backward/forwardInclude` set to `false`. You can change this behavior by setting the property `backwardAllowCurrentPosition` or `forwardAllowCurrentPosition` to `false`. Now the search will be at the next possible position before or after, and the selection is extended.

## Select By with forwardNext

By using the **forward** and **forwardNext** Regular Expressions you can modify the selection from the current selection end, or cursor position, by searching first for the **forward** Regular Expression and from that location search again for a Regular Expression to determine the end of the new selection.

It does not make sense to specify the **backward** Regular Expression. It has no effect on the result.

It is possible in the **forwardNext** Regular Expression to use captured groups `()` from the **forward** Regular Expression. It uses a special syntax to fill in the text from the captured groups. Use `{{n}}` to use captured group `n` from the **forward** Regular Expression. To use captured group 1 you use `{{1}}`.

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

## Select By with forwardNextExtendSelection

Based on idea by [johnnytemp](https://github.com/rioj7/select-by/pull/10).

If you set `forwardNextExtendSelection` to `true` the selection is extended with the next occurrence of `forwardNext` Regular Expression if the start of the selection matches the `forward` Regular Expression.

The `forwardNext` Regular Expression must match at the selection end. If there is not a match at the selection end we start a new `forward` search at the selection end, just like a normal `forward`-`forwardNext`. You can extend the `forwardNext` match to any position by prefixing the Regular Expression with `[\s\S]*?` or `.*?` (non greedy anything), depending if you want to include new lines or not.

At the moment it only works if `forwardNextInclude` is `true`.

### Example 1: Extend with the next item of a tuple

This example extends the selection with the next tuple element if the selection start is after the tuple open paranthesis `(`.

If there are no more elements in the tuple after the selection go to the next tuple.

Put this in your `settings.json` file:

```json
    "selectby.regexes": {
      "extendNextTupleItem": {
        "forward": "\\(",
        "forwardNext": "[^,)]+(\\s*,\\s*)?",
        "forwardInclude": false,
        "forwardNextExtendSelection": true,
        "label": "Extend next tuple item $(arrow-right)",
        "description": "from tuple start"
      }
    }
```

And define a keybinding.

If it is not important that the selection starts at the first tuple item and the items are all word characters you can use:

```json
    "selectby.regexes": {
      "extendNextTupleItem2": {
        "forward": "(?=\\w+)",
        "forwardNext": "\\w+(\\s*,\\s*)?",
        "forwardNextExtendSelection": true
      }
    }
```

The `forward` Regular Expression searches for a location that is followed by a tuple item. It is an empty match.

### Example 2: Extend selection always with forwardNext

If you want to extend the selection always with `forwardNext`, you can set the `forward` Regular Expression to the string `(?=[\s\S])` or `(?=.)`, depending if you want to include new lines or not.

The examples are to extend the selection with the next part of the sentence. If you have line breaks in the sentence you should use the second alternative.

```json
    "selectby.regexes": {
      "extendWithSentensePart": {
        "forward": "(?=.)",
        "forwardNext": ".*?[,.]",
        "forwardNextExtendSelection": true
      }
    }
```

or

```json
    "selectby.regexes": {
      "extendWithSentensePart": {
        "forward": "(?=[\\s\\S])",
        "forwardNext": "[\\s\\S]*?[,.]",
        "forwardNextExtendSelection": true
      }
    }
```

But this could already be done with this setting:

```json
    "selectby.regexes": {
      "extendWithSentensePart": {
        "forward": "[\\s\\S]*?[,.]"
      }
    }
```

## Select By with Surround

If the cursor or selection is inside of the text you want to select and can be described with a single regular expression you use the `surround` Regular Expression.

If you place the cursor somewhere inside a floating point number and you want to select the number you can use the following setting:

```json
    "selectby.regexes": {
      "selectFloat": {
        "surround": "[-+]?\\d+(\\.\\d+)?([eE][-+]?\\d+)?[fF]?"
      }
    }
```

For fast access you can [create a keybinding](#select-by-with-keybindings) for this just like the `Ctrl+D` for select word.

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
        "backward": false
      }
    }
```

# Select By Paste Clipboard

If you paste the clipboard content with Ctrl+V you loose the selection.

The command **Paste clipboard and select** (`selectby.pasteClipboard`) replaces the current selection with the content of the clipboard and keep it selected.

If you need it regularly a keybinding can be handy

```json
  {
    "key": "ctrl+k ctrl+v",
    "when": "editorTextFocus",
    "command": "selectby.pasteClipboard"
  }
```

It only works for single selection. If you use a copy with multi cursor selections the content of the clipboard does not show where each selection begins. There are extra empty lines added but they could also be part of a selection.

# Select By Line Number

If you want to place a cursor on each line where the line number matches multiple boolean expressions you can use the command **Place cursor based on line number, uses boolean expression** (`selectby.lineNr`).

The boolean expression uses the following variables:

* `c` : contains the line number of the cursor or the start of the first selection. When using [`inselection`](#inselection) it means the start of the selection.
* `n` : contains the line number of the line under test, each line of the current document is tested
* `k` : is a placeholder to signify a modulo placement. Can only be used in an expression like `c + 6 k`. Meaning every line that is a multiple (k ∈ ℕ) of 6 from the current line. Every expression of the form `c + 6 k` is transformed to <code>((n-c)%<em>number</em>==0 && n>=c)</code>.

The input box for the lineNr expression remembers the last entered lineNr expression for this session.

The command can be used in a keybinding:

```json
  {
    "key": "ctrl+k ctrl+k",
    "when": "editorTextFocus",
    "command": "selectby.lineNr",
    "args": { "lineNrEx": "c+5k && n-c<100" }
  }
```

This selects every 5<sup>th</sup> line for the next 100 lines.

## Place multiple cursors per block or relative to block start

The expression `c + 6 k` places a cursor at the start of a modulo _block_. Maybe you want to place cursors at lines 1, 3 and 4 relative to the block start. You can use an expression like:

```
n>=c && ( (n-c)%6==1 || (n-c)%6==3 || (n-c)%6==4 )
```

If you want to place cursors at the first 3 lines of a block use:

```
n>=c && (n-c)%6<3
```

This can also be achieved with `c+6k` followed by **Selection** | **Add Cursor Below** 2 times

## `inselection`

Feature request by [blueray](https://stackoverflow.com/questions/69263442/how-to-put-cursor-on-every-other-line-on-alternate-lines)

If you want every selection to be treated separately or you want the command to figure out the end line test (`&& n<=100`) you can add `&& inselection`. The text `inselection` is transformed to <code>((n>=<em>startLineNr</em>) && (n<=<em>endLineNr</em>))</code>. Where <em>startLineNr</em> and <em>endLineNr</em> are from each selection. If the end of a selection is at the start of a line that line is not considered to be part of the selection.

This is also useful to add to a keybinding, now the end line test depends on the selected text.

```json
  {
    "key": "ctrl+k ctrl+k",
    "when": "editorTextFocus",
    "command": "selectby.lineNr",
    "args": { "lineNrEx": "c+5k && inselection" }
  }
```

# Select By Remove Cursor

If you have a Multi Cursor you can't remove a cursor with **Cursor Undo** (`cursorUndo`) when you have done some edit action.

The following commands remove a cursor/selection:

* `selectby.removeCursorBelow` : remove the last cursor/selection
* `selectby.removeCursorAbove` : remove the first cursor/selection

A suggestion for keybinding:

```json
  {
    "key": "ctrl+alt+/",
    "command": "selectby.removeCursorAbove",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+alt+'",
    "command": "selectby.removeCursorBelow",
    "when": "editorTextFocus"
  }
```

# Select By Mark

## selectby.mark

The command is `selectby.mark`.

The `"args"` argument of the command can have the following properties:

* `first`: boolean, when `true` this command will behave as if it is the first call (remembers the start positions), usefull on command scripts like multi-command

The first time you call the command it remembers the start positions of the current selections.

The second call of the command creates selections from the marked (stored) positions to the active positions of the current selections. If the number of cursors differ it shows a warning.

You can create a key binding for this command or call it from the Command Palette.

Currently they are not bound to the particular editor/file so you can use cursor positions from one file (first mark) in another file (second mark)

You can use a second mark to view the selections up to now. Follow it by an immediate first mark to remember the selection starts if you want to continue to modify the cursor positions.

You can combine it with the `moveby.regex` command of this extension to move the cursors by a search for a regular expression.

The marked positions are decorated with a ◆ character using the `editor.selectionBackground` color.

## selectby.mark-restore

The command is `selectby.mark-restore`.

The `"args"` argument of the command can have the following properties:

* `keepMarks`: boolean, when `true` the marks are not removed (default: `false`)

This command restores the cursor positions to the mark locations. It will clear the mark positions unless you set the argument `keepMarks` to true.

# Select By Anchor and Active by Regex

The command `selectby.regex` modifies the `start` and `end` of the selection. Standard Expand/Shrink Selection (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Arrow</kbd>) modifies the `active` position (cursor) based on the word definition of the language. With the command `selectby.anchorAndActiveByRegex` you can modify the `anchor` and `active` position of the selection(s).

At the moment the command `selectby.anchorAndActiveByRegex` accepts all arguments in an object that is part of the key binding or command call in cases like the extension [multi-command](https://marketplace.visualstudio.com/items?itemName=ryuta46.multi-command).

The argument of the command is an object with the following properties:

* `regex` : global definition of the regular expression to search for
* `flags` : global definition of the flags used by the regular expression (`g` is added by the extension) (default: `""` [no flags])
* `direction` : global definition of the direction to search. (default: `next`)  
  Possible values:
    * `next` : determine the first position of the regex towards the **end** of the file.  
      the new position will be the _end_ of the text matched by the regex
    * `prev` : determine the first position of the regex towards the **begin** of the file.  
      the new position will be the _start_ of the text matched by the regex
* `repeat` : global definition of how often to search for (default: `1`)
* `anchor` : an object, can be empty. Modify the `anchor` position of the selection based on the properties:
    * `regex` : replace global definition if present
    * `flags` : replace global definition if present
    * `direction` : replace global definition if present
    * `repeat` : replace global definition if present
* `active` : an object, can be empty. Modify the `active` position of the selection based on the properties:
    * `regex` : replace global definition if present
    * `flags` : replace global definition if present
    * `direction` : replace global definition if present
    * `repeat` : replace global definition if present

If `anchor` or `active` is not present then that position will not change.

This command supports Multi Cursor (multiple selections).

## Example

Modify the `active` position (cursor) to the next/prev double character that is not a space or tab

By adding an extra modifier key (`alt`) you can make a bigger jump by setting a `repeat`.

```json
  {
    "key": "ctrl+shift+right",
    "command": "selectby.anchorAndActiveByRegex",
    "when": "editorTextFocus",
    "args": {
      "active": { "regex": "([^ \\t])\\1", "direction": "next" }
    }
  },
  {
    "key": "ctrl+shift+left",
    "command": "selectby.anchorAndActiveByRegex",
    "when": "editorTextFocus",
    "args": {
      "active": { "regex": "([^ \\t])\\1", "direction": "prev" }
    }
  },
  {
    "key": "ctrl+shift+alt+right",
    "command": "selectby.anchorAndActiveByRegex",
    "when": "editorTextFocus",
    "args": {
      "active": { "regex": "([^ \\t])\\1", "direction": "next", "repeat": 5 }
    }
  },
  {
    "key": "ctrl+shift+alt+left",
    "command": "selectby.anchorAndActiveByRegex",
    "when": "editorTextFocus",
    "args": {
      "active": { "regex": "([^ \\t])\\1", "direction": "prev", "repeat": 5 }
    }
  }
```

# Select By Multi Cursor with keyboard

You can create and modify Multi Cursors with the keyboard with the commands:

* `selectby.addNewSelection` : Add a new selection at an offset (default: 1)
* `selectby.moveLastSelectionActive` : Modify (extend/reduce) the last selection by moving the Active position `offset` characters left/right (default: 1)
* `selectby.moveLastSelection` : Move the last selection number of characters left/right (default: 1)

All 3 commands have 1 property, set in the `args` property of the key binding. If called from the Command Palette the value of `offset` is `1`.

You can define a set of key bindings to use these commands.

By using a custom context variable (extension [Extra Context](https://marketplace.visualstudio.com/items?itemName=rioj7.extra-context)) to set a mode, and use the `when` clause to determine if we use the default key binding for the arrow keys or our custom key bindings.

With the command `extra-context.toggleVariable` you can toggle the variable and thus the mode.

```json
  {
    "key": "alt+F5", // or some other key combo
    "when": "editorTextFocus",
    "command": "extra-context.toggleVariable",
    "args": {"name": "multiCursorByKeyboard"}
  },
  {
    "key": "ctrl+alt+right",
    "when": "editorTextFocus && extraContext:multiCursorByKeyboard",
    "command": "selectby.addNewSelection",
    "args": {"offset": 1}
  },
  {
    "key": "ctrl+alt+left",
    "when": "editorTextFocus && extraContext:multiCursorByKeyboard",
    "command": "selectby.removeCursorBelow"
  },
  {
    "key": "shift+right",
    "when": "editorTextFocus && extraContext:multiCursorByKeyboard",
    "command": "selectby.moveLastSelectionActive",
    "args": {"offset": 1}
  },
  {
    "key": "shift+left",
    "when": "editorTextFocus && extraContext:multiCursorByKeyboard",
    "command": "selectby.moveLastSelectionActive",
    "args": {"offset": -1}
  },
  {
    "key": "right",
    "when": "editorTextFocus && extraContext:multiCursorByKeyboard",
    "command": "selectby.moveLastSelection",
    "args": {"offset": 1}
  },
  {
    "key": "left",
    "when": "editorTextFocus && extraContext:multiCursorByKeyboard",
    "command": "selectby.moveLastSelection",
    "args": {"offset": -1}
  }
```

# Select By Move Selections

Sometimes the selection commands select a few characters too much or too little.

With the command `selectby.moveSelections` you can adjust the selection ends a few characters.

The _number_ values of the properties can be positive, negative or zero.

The `args` property of the command has the following properties:

* `offset` : _number_, move both **start** and **end** _number_ characters 
* `start` : _number_, move **start** _number_ characters 
* `end` : _number_, move **end** _number_ characters 
* `anchor` : _number_, move **anchor** _number_ characters 
* `active` : _number_, move **active** _number_ characters 

`active` side of the selection is the side where the cursor is.

Which properties are used is determined by:

1. `start` or `end` defined. Use `start` and `end`. The property not defined has a value of `0`
1. `anchor` or `active` defined. Use `anchor` and `active`. The property not defined has a value of `0`
1. use `offset`

Example:

Reduce the selections 1 character at the start and end.

```json
  {
    "key": "ctrl+i r",
    "when": "editorTextFocus",
    "command": "selectby.moveSelections",
    "args": {"start": 1, "end": -1}
  }
```

It can also be combined to modify a selection command using the extension [multi-command](https://marketplace.visualstudio.com/items?itemName=ryuta46.multi-command).

If you don't want the brackets to be selected when using the **Select to Bracket** command:

```json
  {
    "key": "ctrl+i ctrl+b",  // or any other combo
    "command": "extension.multiCommand.execute",
    "args": { 
        "sequence": [
            "editor.action.selectToBracket",
            { "command": "selectby.moveSelections", "args": {"start": 1, "end": -1} }
        ]
    }
  }
```

# Select By Add Selection To Next Find Match Multi Cursor

Multi Cursor variant of **Add Selection To Next Find Match** (`Ctrl+D`).

The commandID is: `selectby.addSelectionToNextFindMatchMultiCursor`

Consider each selection separate. Find the **next** occurrence of the same text. If this happens **before** the next selection add this **next** occurrence to the selections.

# Move By

You can move the cursor based on [Regular Expressions](#move-by-regular-expression) or using a [Calculation](#move-by-calculation).

## Move By Regular Expression

The exported command is: `moveby.regex` (**MoveBy: Move cursor based on regex**)

To use fixed Regular Expressions or different properties for MoveBy you can create:

* 1 or more [key bindings in `keybindings.json`](https://code.visualstudio.com/docs/getstarted/keybindings). In the `args` property of the key binding you define the regex and properties.
* define named regex and properties in the setting `moveby.regexes` and select one from a QuickPick list.

The argument of the command can be:

* `undefined` : when called from Command Palette or key binding without argument  
  You are presented with a QuickPick list of arguments defined in the setting `moveby.regexes`.  
  If `moveby.regexes` is empty it behaves as if the argument of the key binding or command was:
  ```json
  "args": {
    "ask": true,
    "properties": ["next", "end", "nowrap"]
  }
  ```
* a **string** : this is used as the key in the setting `moveby.regexes` to get an array or object.
* an **array** : [key binding with an `"args"` property that is an Array](#args-of-keybinding-is-an-array)
* an **object** : [key binding with an `"args"` property that is an Object](#args-of-keybinding-is-an-object)

In the setting `moveby.regexes` you can define frequently used regex searches that you select from a QuickPick list. These searches are named (_`key`_). The name can also be used as string argument in a key binding or multi-command sequence.

The setting `moveby.regexes` is an object with key-value pairs. The value can be an [array](#args-of-keybinding-is-an-array) or an [object](#args-of-keybinding-is-an-object).

* the key for the search arguments can have any name
* if the value is an object a few extra properties can be used
    * `debugNotify`: show a notify message of the used search properties (User and Workspace properties are merged) (default: `false`)
    * `label`, `description`, `detail`: (Optional) when MoveBy is called from the command palette it shows a QuickPick list. These 3 properties (`strings`) are used in the construction of the [QuickPickItem](https://code.visualstudio.com/api/references/vscode-api#QuickPickItem). The default value for `label` is the key name. The label is decorated with an additional icon in case the object contains the parameter `debugNotify`. In the 3 properties you can [use other icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html) with the <code>&dollar;(<em>name</em>)</code>-syntax.

An example for the setting `moveby.regexes`:

```json
  "moveby.regexes": {
    "Go to Last Dot": {
      "regex": "\\.(?!.*\\.)",
      "properties": ["next", "start"]
    },
    "--Ask-- $(regex) next end": {
      "ask": true,
      "properties": ["next", "end"]
    },
    "--Ask-- $(regex) next start": {
      "ask": true,
      "properties": ["next", "start"]
    }
  }
```

You can use [icons](https://microsoft.github.io/vscode-codicons/dist/codicon.html) in the _key_ of the setting `moveby.regexes`.

If you define setting `moveby.regexes` and you want the **Ask** regex functionality if called from the Command Palette you have to add a definition for this in the setting `moveby.regexes`.

The details of the search are specified in the `"args"` property of the key binding. The `"args"` property can be an Array or an Object.

## args of keybinding is an Array

If the `"args"` property of the key binding is an Array the meaning of the 5 strings are:

* index 0: the key/name of the range you want to use as defined in the settings option `selectby.regexes`
* index 1: `"forward"` | `"backward"` | `"moveby"` | `"forwardNext"` - which regex string should be used
* index 2: `"prev"` | `"next"` - search direction - do you want to search for the **previous** or **next** occurrence of the Regular Expression (default: `"next"`)
* index 3: `"start"` | `"end"` - should the cursor move to the **start** or the **end** of the found Regular Expression (default: `"end"`)
* index 4: `"wrap"` | `"nowrap"` - optional argument: do we wrap to other side of the file and continue search if not found  (default: `"nowrap"`) (proposed by [Arturo Dent](https://github.com/rioj7/select-by/issues/8))

If the last element of the array is a default value you can omit that argument. You can apply this rule multiple times. But naming the first 4 arguments helps in the readability of the keybinding.

To use regular expressions that are not used in selections you can use the `"moveby"` property of the `selectby.regexes` elements or you can duplicate the `"forward"` or `"backward"` field. This property is just added to prevent confusion in the specification of `"args"` (`"forward"` does not mean to search in the forward direction)

## args of keybinding is an Object

If the `"args"` property of the key binding is an Object it can have the following properties:

* `flags`: a string with the regex flags "`i`" and/or "`m`" (default: "")
* `regex`: the regular expression to use, (default: ask for regular expression with InputBox)
* `ask`: a boolean to signal that the regex should be asked from the user, it is optional because if the `regex` property is missing it will be asked.<br/>Just to remind you later which regex is used.
* `properties`: an Array of strings with the values corresponding to Array indexes (2,3,4) from the section: [args of keybinding is an Array](#args-of-keybinding-is-an-array)<br/>The order of the properties is not important. (default: `["next", "end", "nowrap"]`)
* `repeat`: how many times to repeat the `moveby`. An integer or a string of an integer. If value is `"ask"` the user needs to enter a number. Choose the correct `"end"` or `"start"` or it will only happen once (default: `1`)
* `checkCurrent`: check if current cursor position is a possible match (default: `false`)

If you want to move the cursor(s) to the first character inside the next Python string you can use:

```json
  {
    "key": "ctrl+f6",  // or any other key combo
    "when": "editorTextFocus",
    "command": "moveby.regex",
    "args": {
      "regex": "('''|\"\"\"|'|\")",
      "properties": ["next", "end"]
    }
  }
```

If you want to move the cursor(s) to the start of the next regex asked from the user you can use:

```json
  {
    "key": "ctrl+shift+f6",  // or any other key combo
    "when": "editorTextFocus",
    "command": "moveby.regex",
    "args": {
      "ask": true,
      "properties": ["next", "start"]
    }
  }
```

If you want to move _n_, ask user how often, `<td>` tags forward use:

```json
  {
    "key": "alt+f6",  // or any other key combo
    "when": "editorTextFocus",
    "command": "moveby.regex",
    "args": {
      "regex": "<td[^>]*>",
      "properties": ["next", "end"],
      "repeat": "ask"
    }
  }
```

if you want to insert a snippet at the end of an HTML open tag

```json
  {
    "key": "alt+f7", // or any other key combo
    "when": "editorTextFocus",
    "command": "extension.multiCommand.execute",
    "args": {
      "sequence": [
        { "command": "moveby.regex",
          "args": { "regex": ">", "properties": ["next", "start"]}, "checkCurrent": true },
        { "command": "editor.action.insertSnippet",
          "args": { "snippet": " class=\"$1\"$0" } }
      ]
    }
  }
```

In a next version it will use a selection list with recently used entries on top. The default QuickPick list does not allow to enter a new item. And a list of starting Regular Expressions.

## Move By Calculation

The exported command is: `moveby.calculation`

**All positions (line and char) are 0 based.** The first line has number 0.

Move By uses 2 calculation expressions defined in the `"args"` property of the key binding.

* `lineNrEx` : calculate the new line number of the selection, default value is `"selection.start.line"` (the line number of the start of the selection)
* `charNrEx` : calculate the new character position of the selection

The expressions can be any JavaScript expression that results in a number. The number is converted to an int with [`Math.floor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor)

The expressions can use a number of variables:

* `selection.start.line`
* `selection.start.character`
* `selection.end.line`
* `selection.end.character`
* `selections` : the full array of all current selections/cursors. You can use the `start` and `end` property of a particular selection. To get the last selection use `selections[selections.length-1]`
* `currentLine` : a string with the text of the line where the selection starts
* `currentLine.length` : the length of `currentLine` variable
* `offset.line` : Ask the user for an offset (relative to start of file) and calculate line and character position
* `offset.character`
* `relative` : Ask the user for a number (positive or negative) to be used to calculate a relative line or character position

If you want to move the cursor to the midpoint of the line the cursor is on you can use

```json
  {
    "key": "ctrl+i ctrl+m",  // or any other key binding
    "when": "editorTextFocus",
    "command": "moveby.calculation",
    "args": {
      "charNrEx": "currentLine.length / 2"
    }
  }
```

If something reports a problem at a character offset (relative to start of file) you can use:

```json
  {
    "key": "ctrl+i ctrl+f",  // or any other key binding
    "when": "editorTextFocus",
    "command": "moveby.calculation",
    "args": {
      "lineNrEx": "offset.line",
      "charNrEx": "offset.character"
    }
  }
```

If you want a **Go To Line** but enter a relative line number use:

```json
  {
    "key": "ctrl+alt+g",  // or any other key binding
    "when": "editorTextFocus",
    "command": "moveby.calculation",
    "args": {
      "lineNrEx": "selection.start.line+relative",
      "charNrEx": "selection.start.character"
    }
  }
```

## `moveby` and Multi Cursor

`moveby.regex` and `moveby.calculation` support multi cursor. For each cursor the search is performed or the cursor is moved to the new location.

If the Regular Expression is not found for a particular selection/cursor the behavior depends on the number of cursors that have found a new location:

* if none have found a new location nothing happens and selections/cursors do not change
* if one or more cursors have found a new location this selection/cursor is removed, so you are sure the cursors remaining are at valid locations, they can be at previous locations of another cursor

If more than one cursor end at the same location they will be collapsed into one.

## Reveal the new cursor locations

With the setting `"moveby.revealType"` you can change the behavior of how the cursor should be revealed after the move. In the Settings UI, group **Extensions** | **Select By**, it is a dropdown box with possible values. These strings are identical to the VSC API enum [TextEditorRevealType](https://code.visualstudio.com/api/references/vscode-api#TextEditorRevealType). If there are multiple cursors the first cursor is used.

## Move By and `keybindings.json`

You can create a key binding with the UI of VSC but you have to add the `"args"` property by modifying `keybindings.json`. If you do not define the `"args"` property it behaves as called from the Command Palette.

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
