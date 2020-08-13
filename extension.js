const vscode = require('vscode');

function activate(context) {

  var getProperty = (obj, prop, deflt) => { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };
  var isString = obj => typeof obj === 'string';
  var getConfigRegEx = regexKey => {
    let regexes = vscode.workspace.getConfiguration('selectby', null).get('regexes');
    if (!regexes.hasOwnProperty(regexKey)) {
      vscode.window.showErrorMessage(regexKey+" not found.");
      return undefined;
    }
    let search = regexes[regexKey];
    if (getProperty(search, "debugNotify", false)) {
      vscode.window.showInformationMessage(JSON.stringify(search));
    }
    return search;
  };
  var processRegEx = (regexKey, editor) => {
    if (!isString(regexKey)) { regexKey = 'regex' + regexKey.toString(10); }
    let search = getConfigRegEx(regexKey);
    if (search === undefined) { return; }
    var docText = editor.document.getText();
    // position of cursor is "start" of selection
    var offsetCursor = editor.document.offsetAt(editor.selection.start);
    var selectStart = offsetCursor;
    var flags = getProperty(search, "flags", "") + "g";
    var regex;
    regex = getProperty(search, "backward");
    if (regex && isString(regex)) {
      var incMatch = getProperty(search, "backwardInclude", true);
      regex = new RegExp(regex, flags);
      selectStart = 0;
      regex.lastIndex = 0;
      var result;
      while ((result=regex.exec(docText)) != null) {
        if (result.index >= offsetCursor) break;
        selectStart = incMatch ? result.index : regex.lastIndex;
      }
    }
    var selectEnd = editor.document.offsetAt(editor.selection.end);
    var selectNewStartForForwardNext = selectEnd;
    regex = getProperty(search, "forward");
    var regexForwardNext = getProperty(search, "forwardNext");
    var startForwardNext = selectEnd;
    var forwardResult = [];
    if (regex && isString(regex)) {
      var incMatch = getProperty(search, "forwardInclude", true);
      regex = new RegExp(regex, flags);
      regex.lastIndex = selectEnd;
      selectNewStartForForwardNext = selectEnd = docText.length;
      var result;
      while ((result=regex.exec(docText)) != null) {
        selectEnd = incMatch ? regex.lastIndex : result.index;
        selectNewStartForForwardNext = incMatch ? result.index : regex.lastIndex; // we have to flip range's meaning from "end" to "start"
        startForwardNext = regex.lastIndex;
        forwardResult = result.slice();
        break;
      }
    }
    if (regexForwardNext && isString(regexForwardNext)) {
      var incMatch = getProperty(search, 'forwardNextInclude', true);
      // **NEW** "forwardNextInsteadExtendsSelectionIfAny" boolean option: indicate "forwardNext" pattern should extend selection (instead of starting selection again, i.e. making a jump, from the selectNewStartForForwardNext - the selection end after "forward") if the current modified range (selectStart, selectEnd) is non-empty
      var insteadExtendsSelectionIfAny = getProperty(search, 'forwardNextInsteadExtendsSelectionIfAny', false);
      // **NEW** "forwardNextIncludeExclusivelyWhen" string option: when condition holds, the "forwardNext" pattern match itself should be selected exclusively; "jumped" -> condition if the "forwardNext" pattern match is not at the first position (startForwardNext); "always" -> always true; "never" (default) -> never true
      var includeExclusivelyWhen = incMatch ? getProperty(search, 'forwardNextIncludeExclusivelyWhen', 'never') : 'never';
      /**
       * ## Example rule:
       *
       * ```
       * "selectby.regexes": {
       *   "Select/extend-to next tuple item": {
       *     "forward": "\\s*",
       *     "forwardInclude": false,
       *     "forwardNext": "\\w+\\s?(,\\s*)?",
       *     "forwardNextInsteadExtendsSelectionIfAny": true,
       *     "forwardNextIncludeExclusivelyWhen": "jumped"
       *   }
       * }
       * ```
       *
       * "Select/extend-to next tuple item" may be used to select single/multiple tuple items for swapping orders, removing or copying.
       *
       * ### Run rule result:
       *
       * ```
       * (  v original cursor after "1," )
       * (1,`' 2, 3)  -->  (1, `2, '3)  -->  (1, `2, 3')  -->  (1, 2, 3)    -->  (1, 2, 3)    -->  (1, 2, 3)    -->  (1, 2, 3)
       * (4, 5, 6)         (4, 5, 6)         (4, 5, 6)         (`4, '5, 6)       (`4, 5, '6)       (`4, 5, 6')       (4, 5, 6)`'
       * ```
       *
       * Terminology:
       * * `..' : indicate a selection
       * * -->  :  show the `..' selection after a "Select/extend-to next tuple item" command
       *
       */

      /**
       * (Additional) Truth table - for the "Select/extend-to next tuple item" rule example:
       *
       * forwardInclude   original+backward+forward is empty    forwardNext jumped   extends-sel?   exclusive-sel?   depends on forwardNextInsteadExtendsSelectionIfAny/forwardNextIncludeExclusivelyWhen
       * n                y                                     y                    n              y                forwardNextIncludeExclusivelyWhen - in (always, jumped) -> yes
       * n                y                                     n                    n              y (always)       nothing
       * n                n                                     y                    n              y                both
       * n                n                                     n                    y              n                both
       *
       */

      var hasSelection = selectStart != selectEnd; // whether the current modified range - (selectStart, selectEnd) - is not empty
      if (!(insteadExtendsSelectionIfAny && hasSelection)) {
        selectStart = selectNewStartForForwardNext;
      }
      regexForwardNext = regexForwardNext.replace(/{{(\d+)}}/g, (match, p1) => {
        let groupNr = parseInt(p1, 10);
        if (groupNr >= forwardResult.length) { return ""; }
        return forwardResult[groupNr];
      });
      regex = new RegExp(regexForwardNext, flags);
      regex.lastIndex = startForwardNext;
      selectEnd = docText.length;
      var result;
      while ((result=regex.exec(docText)) != null) {
        selectEnd = incMatch ? regex.lastIndex : result.index;
        break;
      }
      var matchStart = result != null ? result.index : docText.length;
      // allow to select the regex match of forwardNext only, without the gap between last selection end (i.e. between previous selectEnd & this "forwardNext" match's start).
      var hasJumped = matchStart > startForwardNext; // i.e. if not a direct match anchored at startForwardNext
      if (includeExclusivelyWhen === 'always' || (includeExclusivelyWhen === 'jumped' && hasJumped)) {
        selectStart = matchStart;
      }
    }
    if (getProperty(search, "copyToClipboard", false)) {
      vscode.env.clipboard.writeText(docText.substring(selectStart, selectEnd)).then((v)=>v, (v)=>null);
    }
    if (getProperty(search, "showSelection", true)) {
      editor.selection = new vscode.Selection(editor.document.positionAt(selectStart), editor.document.positionAt(selectEnd));
      editor.revealRange(editor.selection);
    }
  };

  var selectbyRegEx = (editor, args) => {
    if (args === undefined) {
      vscode.window.showInformationMessage("Need keybinding with \"args\" property");
      return; // TODO use QuickSelect to get regexKey
    }
    processRegEx(args[0], editor);
  };

  var findRegexLocation = (editor, regexKey, regexFBM, nextPrev, startEnd, wrapCursor) => {
    let search = getConfigRegEx(regexKey);
    if (search === undefined) { return undefined; }

    var docText = editor.document.getText();

    var findPrev = (nextPrev === "prev");
    var findStart = (startEnd === "start");
    wrapCursor = (wrapCursor === "wrap");
    var wrappedCursor = false;
    var offsetCursor = editor.document.offsetAt(findPrev ? editor.selection.start : editor.selection.end);
    var location = offsetCursor;
    var flags = getProperty(search, "flags", "") + "g";
    var regex;
    regex = getProperty(search, regexFBM);
    if (regex && isString(regex)) {
      regex = new RegExp(regex, flags);
      regex.lastIndex = findPrev ? 0 : offsetCursor;
      while (true) {
        let prevLastIndex = regex.lastIndex;
        let result=regex.exec(docText);
        if (result === null) {
          if (wrapCursor) {
            wrapCursor = undefined; // only wrap once
            if (findPrev) {
              break; // leave cursor at current location
            } else {
              regex.lastIndex = 0;
              result = regex.exec(docText);
              if (result == null) { break; } // leave cursor at current location
              if (result.index == 0) { // found at start of file
                location = findStart ? result.index : regex.lastIndex;
                break;
              }
              location = 0;
              offsetCursor = location;
              regex.lastIndex = location;
              continue;
            }
          }
          break;
        }
        var resultLocation = findStart ? result.index : regex.lastIndex;
        if (prevLastIndex === regex.lastIndex) { // search for empty line
          regex.lastIndex = prevLastIndex + 1;
        }
        if (findPrev) {
          // for the regex in the file: #hit >= 1
          if (resultLocation >= offsetCursor) {
            if (offsetCursor === docText.length && wrappedCursor && resultLocation === offsetCursor) {
              location = offsetCursor; // a hit at the very end of the file
              break;
            }
            if (location !== offsetCursor) { break; } // found one before offsetCursor
            if (wrapCursor) {
              wrapCursor = undefined; // only wrap once
              wrappedCursor = true;
              offsetCursor = docText.length;
              location = offsetCursor;
              regex.lastIndex = 0;
              continue;
            }
            break;
          }
          location = resultLocation;
        } else { // Next
          if (resultLocation > offsetCursor) {
            location = resultLocation;
            break;
          }
        }
      }
    }
    return location;
  };
  var movebyRegEx = (editor, args) => {
    if (args === undefined) return; // TODO use QuickSelect to construct an args array
    var location = findRegexLocation(editor, args[0], args[1], args[2], args[3], args[4]);
    if (location === undefined) return;
    location = editor.document.positionAt(location);
    editor.selection = new vscode.Selection(location, location);
    var rng = new vscode.Range(location, location);
    editor.revealRange(rng, vscode.TextEditorRevealType[vscode.workspace.getConfiguration('moveby', null).get('revealType')]);
  };

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex1', (editor, edit, args) => { processRegEx(1, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex2', (editor, edit, args) => { processRegEx(2, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex3', (editor, edit, args) => { processRegEx(3, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex4', (editor, edit, args) => { processRegEx(4, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex5', (editor, edit, args) => { processRegEx(5, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex', (editor, edit, args) => { selectbyRegEx(editor, args);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.regex', (editor, edit, args) => { movebyRegEx(editor, args);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
