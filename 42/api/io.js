import { filePickerOpen, filePickerSave } from "../ui/desktop/explorer.js"
import { fileExport } from "./io/fileExport.js"
import { fileImport } from "./io/fileImport.js"

class IO {
  fileImport = fileImport
  fileExport = fileExport
  filePickerOpen = filePickerOpen
  filePickerSave = filePickerSave
}

export const io = new IO()
