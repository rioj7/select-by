# Change Log

## [1.17.0] 2022-09-05
### Added
- `selectby.moveSelections` : move selections start/end/anchor/active a given offset

## [1.16.1] 2022-07-26
### Fixed
- `selectby.regex` : fix: shows QuickPick list if args in key binding is an Array with regex name

## [1.16.0] 2022-06-15
### Added
- `moveby.regex` : show QuickPick list of predefined searches if called from Command Palette or no args in key binding

## [1.15.0] 2022-05-13
### Added
- `selectby.mark-restore` : restore position of cursors to mark locations

## [1.14.1] 2022-04-02
### Added
- Create and modify Multi Cursors with the keyboard:
  - `selectby.addNewSelection`
  - `selectby.moveLastSelectionActive`
  - `selectby.moveLastSelection`

## [1.13.0] 2022-03-11
### Added
- `selectby.anchorAndActiveByRegex` : Modify the anchor and active position of the selection(s)

## [1.12.0] 2022-02-17
### Added
- `forwardShrink` and `backwardShrink` to reduce selection
- add CHANGELOG.md

## [1.11.0] 2022-01-30
### Added
- `moveby.calculation` by offset

## [1.10.0] 2022-01-05
### Added
- `selectby.anchorAndActiveSeparate`

## [1.9.0] 2021-11-05
### Added
- `selectby.mark` : argument `first` to reset call number
- web extension

## [1.8.0] 2021-09-22
### Added
- `selectby.linenr` : `inselection` only places cursors in the selections

## [1.7.0] 2021-08-19
### Added
- `selectby.mark` : Mark position of cursor(s), create selection(s) on next mark

## [1.6.0] 2021-08-02
### Added
- `forward/backwardAllowCurrentPosition`

## [1.5.1] 2021-06-27
### Added
- `moveby.regex` fix a few cases

## [1.5.0] 2021-06-18
### Added
- `moveby.regex` add `checkCurrent` option

## [1.4.0] 2021-05-24
### Added
- `selectby.swapActive` swap cursor position within selection(s)

## [1.3.1] 2021-03-22
### Added
- `moveby.calculation` now has `selections` variable

## [1.3.0] 2021-03-06
### Added
- `selectby.regex` in keybinding can have an object as `args` property

## [1.2.0] 2021-02-23
### Added
- `moveby.regex` has repeat property with ask possibility

## [1.1.0] 2021-02-22
### Added
- `selectby.removeCursor(Above|Below)` reduce number of Multi Cursors

## [1.0.0] 2020-11-25
### Added
- `moveby.calculation` move the cursor to `lineNr:charPos` with a calculation
