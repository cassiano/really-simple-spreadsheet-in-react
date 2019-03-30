import React from "react";
import ReactDOM from "react-dom";
import Spreadsheet from "./spreadsheet";

ReactDOM.render(
  <Spreadsheet initialRows={4} initialCols={3} />,
  document.getElementById("root")
);
