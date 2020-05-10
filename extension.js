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
    regex = getProperty(search, "forward");
    var regexForwardNext = getProperty(search, "forwardNext");
    var startForwardNext = selectEnd;
    var forwardResult = [];
    if (regex && isString(regex)) {
      var incMatch = getProperty(search, "forwardInclude", true);
      if (regexForwardNext && isString(regexForwardNext)) { // we have to flip the incMatch
        incMatch = !incMatch;
      }
      regex = new RegExp(regex, flags);
      regex.lastIndex = selectEnd;
      selectEnd = docText.length;
      var result;
      while ((result=regex.exec(docText)) != null) {
        selectEnd = incMatch ? regex.lastIndex : result.index;
        startForwardNext = regex.lastIndex;
        forwardResult = result.slice();
        break;
      }
    }
    if (regexForwardNext && isString(regexForwardNext)) {
      selectStart = selectEnd;
      var incMatch = getProperty(search, "forwardNextInclude", true);
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
    }
    if (getProperty(search, "copyToClipboard", false)) {
      vscode.env.clipboard.writeText(docText.substring(selectStart, selectEnd)).then((v)=>v, (v)=>null);
    }
    if (getProperty(search, "showSelection", true)) {
      editor.selection = new vscode.Selection(editor.document.positionAt(selectStart), editor.document.positionAt(selectEnd));
    }
  };

  var selectbyRegEx = (editor, args) => {
    if (args === undefined) {
      vscode.window.showInformationMessage("Need keybinding with \"args\" property");
      return; // TODO use QuickSelect to get regexKey
    }
    processRegEx(args[0], editor);
  };

  var findRegexLocation = (editor, regexKey, regexFBM, nextPrev, startEnd) => {
    let search = getConfigRegEx(regexKey);
    if (search === undefined) { return undefined; }

    var docText = editor.document.getText();

    var findPrev = (nextPrev === "prev");
    var findStart = (startEnd === "start");
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
        if (result === null) break;
        var resultLocation = findStart ? result.index : regex.lastIndex;
        if (prevLastIndex === regex.lastIndex) { // search for empty line
          regex.lastIndex = prevLastIndex + 1;
        }
        if (findPrev) {
          if (resultLocation >= offsetCursor) break;
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
    var location = findRegexLocation(editor, args[0], args[1], args[2], args[3]);
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
