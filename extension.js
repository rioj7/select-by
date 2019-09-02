const vscode = require('vscode');
// const path = require('path');

function activate(context) {
  // const nonPosixPathRexEx = new RegExp('^/([a-zA-Z]):/');

  var processRegEx = (nr, editor) => {
    let regexes = vscode.workspace.getConfiguration('selectby').get('regexes');
    let key = 'regex' + nr.toString(10);
    if (!regexes.hasOwnProperty(key)) {
      vscode.window.showErrorMessage('Regex '+nr.toString(10)+" not found.");
      return;
    }
    let search = regexes[key];
    var docText = editor.document.getText();
    // position of cursor is "start" of selection
    var offsetCursor = editor.document.offsetAt(editor.selection.start);
    var selectStart = offsetCursor;
    var flags = (search.hasOwnProperty("flags") ? search["flags"] : "") + "g";
    if (search.hasOwnProperty("backward")) {
      var incMatch = search.hasOwnProperty("backwardInclude") ? search["backwardInclude"] : true;
      var regex = new RegExp(search["backward"], flags);
      selectStart = 0;
      regex.lastIndex = 0;
      var result;
      while ((result=regex.exec(docText)) != null) {
        if (result.index >= offsetCursor) break;
        selectStart = incMatch ? result.index : regex.lastIndex;
      }
    }
    var selectEnd = offsetCursor;
    if (search.hasOwnProperty("forward")) {
      var incMatch = search.hasOwnProperty("forwardInclude") ? search["forwardInclude"] : true;
      var regex = new RegExp(search["forward"], flags);
      selectEnd = docText.length;
      regex.lastIndex = offsetCursor;
      var result;
      while ((result=regex.exec(docText)) != null) {
        selectEnd = incMatch ? regex.lastIndex : result.index;
        break;
      }
    }
    editor.selection = new vscode.Selection(editor.document.positionAt(selectStart), editor.document.positionAt(selectEnd));
  };
  // let disposable = vscode.commands.registerTextEditorCommand('extension.htmlescape', function (editor, edit, args) {

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex1', (editor, edit, args) => { processRegEx(1, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex2', (editor, edit, args) => { processRegEx(2, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex3', (editor, edit, args) => { processRegEx(3, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex4', (editor, edit, args) => { processRegEx(4, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex5', (editor, edit, args) => { processRegEx(5, editor);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}

// "flags": "i",
// "backward": "%% section",
// "forward": "%% section",
// "forwardInclude": true,
// "backwardInclude": true
