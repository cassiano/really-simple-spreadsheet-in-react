import React from "react";
import Util from "./util";
import Cell from "./cell";
import CellVisualizer from "./cell_visualizer";
import PropTypes from "prop-types";
import "./set_functions";

class Spreadsheet extends React.Component {
  static DEBUG = true;

  constructor(props) {
    super(props);

    const cells = Array(props.initialRows)
      .fill()
      .map((_, row) =>
        Array(props.initialCols)
          .fill()
          .map((_, col) => new Cell(this, Util.asRef(row, col)))
      );

    this.state = {
      cells: cells
    };
  }

  // Initialize the spreadsheet with Fibonacci and Factorial sequences.
  componentDidMount() {
    this.setState((state, props) => {
      this.clonedCells = state.cells.map(row => row.map(cell => cell.clone()));

      // Spiral Fibonacci.
      this.fillSpiral("A1", "E6", (index, ref, visitedCells) =>
        index < 2 ? 1 : `=${visitedCells[index - 2]}+${visitedCells[index - 1]}`
      );

      // Spiral Factorial.
      this.fillSpiral("A8", "E13", (index, ref, visitedCells) =>
        index < 1 ? 1 : `=${index + 1}*${visitedCells[index - 1]}`
      );

      return { cells: this.clonedCells };
    });
  }

  fillSpiral(borderTopLeft, borderBottomRight, valueFn) {
    const [borderTopLeftRow, borderTopLeftCol] = Util.rowColFromRef(
      borderTopLeft
    );
    const [borderBottomRightRow, borderBottomRightCol] = Util.rowColFromRef(
      borderBottomRight
    );

    for (col = borderTopLeftCol + 1; col < borderBottomRightCol; col++) {
      this.cellAt(Util.asRef(borderTopLeftRow, col), this.clonedCells).setValue(
        "━━━━"
      );
      this.cellAt(
        Util.asRef(borderBottomRightRow, col),
        this.clonedCells
      ).setValue("━━━━");
    }

    for (row = borderTopLeftRow + 1; row < borderBottomRightRow; row++) {
      this.cellAt(Util.asRef(row, borderTopLeftCol), this.clonedCells).setValue(
        "┃"
      );
      this.cellAt(
        Util.asRef(row, borderBottomRightCol),
        this.clonedCells
      ).setValue("┃");
    }

    this.cellAt(borderTopLeft, this.clonedCells).setValue("┏");
    this.cellAt(
      Util.asRef(borderTopLeftRow, borderBottomRightCol),
      this.clonedCells
    ).setValue("┓");
    this.cellAt(borderBottomRight, this.clonedCells).setValue("┛");
    this.cellAt(
      Util.asRef(borderBottomRightRow, borderTopLeftCol),
      this.clonedCells
    ).setValue("┗");

    const DIRECTIONS = {
      right: { row: idx => idx, col: idx => idx + 1, turnRightDir: "down" },
      down: { row: idx => idx + 1, col: idx => idx, turnRightDir: "left" },
      left: { row: idx => idx, col: idx => idx - 1, turnRightDir: "up" },
      up: { row: idx => idx - 1, col: idx => idx, turnRightDir: "right" }
    };

    const walk = (direction, row, col) => [
      DIRECTIONS[direction].row(row),
      DIRECTIONS[direction].col(col)
    ];

    let visitedCells = [];
    let direction = "right";
    let cell = this.cellAt(
      Util.asRef(borderTopLeftRow + 1, borderTopLeftCol + 1),
      this.clonedCells
    );
    let nextCell, row, col, previousRow, previousCol;
    let index = 0;

    while (true) {
      [row, col] = Util.rowColFromRef(cell.ref);

      if (cell.value !== "") {
        break;
      }

      cell.setValue(valueFn(index, cell.ref, visitedCells));

      visitedCells = visitedCells.concat(cell.ref);

      [previousRow, previousCol] = [row, col];

      // Walk!
      [row, col] = walk(direction, row, col);

      // Did we reach the spreadsheet boundaries?
      nextCell =
        row < 0 || col < 0
          ? undefined
          : this.cellAt(Util.asRef(row, col), this.clonedCells);

      // Did we reach the border?
      if (nextCell && nextCell.value === "") {
        // No. Keep on walking in the same direction.
        cell = nextCell;
      } else {
        // Yes! Backup one step, turn right and walk again.
        direction = DIRECTIONS[direction].turnRightDir;

        cell = this.cellAt(
          Util.asRef(...walk(direction, previousRow, previousCol)),
          this.clonedCells
        );
      }

      index++;
    }
  }

  static rows(cells = this.clonedCells) {
    return cells.length;
  }

  static cols(cells = this.clonedCells) {
    return Math.max(...cells.filter(row => Boolean).map(row => row.length)); // Ignore empty rows.
  }

  cellAt(ref, cells = this.clonedCells) {
    const [row, col] = Util.rowColFromRef(ref);

    if (
      row >= Spreadsheet.rows(cells) ||
      col >= Spreadsheet.cols(cells) ||
      !cells[row] ||
      !cells[row][col]
    ) {
      cells[row] = cells[row] || [];
      cells[row][col] = new Cell(this, Util.asRef(row, col));

      // Fill blank cells.
      for (let r = 0; r < Spreadsheet.rows(cells); r++) {
        cells[r] = cells[r] || [];

        for (let c = 0; c < Spreadsheet.cols(cells); c++) {
          if (!cells[r][c]) {
            cells[r][c] = new Cell(this, Util.asRef(r, c));
          }
        }
      }
    }

    return cells[row][col];
  }

  detectAffectedCells(cells, currentCell, value) {
    if (currentCell.value === value) {
      return new Set();
    }

    let affectedCells = new Set([currentCell.ref]);
    let formulaRefs = new Set();

    if (Util.isFormula(value)) {
      formulaRefs = Util.findRefsInFormula(value);
    }

    let removedRefs = currentCell.observedCells.diff(formulaRefs);

    affectedCells.concat(formulaRefs);
    affectedCells.concat(removedRefs);

    const allObservers = this.directAndIndirectObservers(
      currentCell.ref,
      cells
    );

    affectedCells.concat(allObservers);

    return affectedCells;
  }

  directAndIndirectObservers(ref, cells, visited = new Set()) {
    visited.add(ref);

    const observers = this.cellAt(ref, cells).observerCells;

    if (observers.size === 0) {
      return new Set();
    }

    const observersOfObservers = [...observers].reduce(
      (acc, ref2) =>
        visited.has(ref2)
          ? acc
          : acc.concat(this.directAndIndirectObservers(ref2, cells, visited)),
      new Set()
    );

    return new Set(observers).concat(observersOfObservers);
  }

  handleBlur(event, row, col) {
    const value = event.target.value;

    this.setState((state, props) => {
      const currentCell = state.cells[row][col];
      const affectedCells = this.detectAffectedCells(
        state.cells,
        currentCell,
        value
      );

      // console.log(`Affected cells: ${[...affectedCells]}`);

      // Clone only previously recalculated, touched or (possibly) affected cells.
      this.clonedCells = state.cells.map(row =>
        row.map(cell =>
          cell.recalculated || cell.touched || affectedCells.has(cell.ref)
            ? cell.clone({ recalculated: false, touched: false })
            : cell
        )
      );

      const currentClonedCell = this.clonedCells[row][col];

      currentClonedCell.setValue(value);

      return { cells: this.clonedCells };
    });
  }

  render() {
    const numCols = Spreadsheet.cols(this.state.cells);
    const numRows = Spreadsheet.rows(this.state.cells);

    const headerRow = [...Array(numCols)].map((_, col) => (
      <td key={col} align="center">
        {Util.colAsRef(col)}
      </td>
    ));

    const dataRows = [...Array(numRows)].map((_, row) => (
      <tr key={row}>
        <td
          align="center"
          style={{ backgroundColor: "lightGray", fontWeight: "bold" }}
        >
          {Util.rowAsRef(row)}
        </td>
        {[...Array(numCols)].map((_, col) => (
          <td key={col}>
            <CellVisualizer
              cell={this.state.cells[row][col]}
              cols={numCols}
              rows={numRows}
              index={col + row * numCols + 1}
              onBlur={e => this.handleBlur(e, row, col)}
            />
          </td>
        ))}
      </tr>
    ));

    let currentStateInfo;

    if (Spreadsheet.DEBUG) {
      currentStateInfo = (
        <pre>
          Spreadsheet: {JSON.stringify(this.state, jsonStringifyReplacer, 2)}
        </pre>
      );
    }

    return (
      <div>
        <table id="spreadsheet" border="1" cellSpacing="0" cellPadding="2">
          <thead style={{ backgroundColor: "lightGray", fontWeight: "bold" }}>
            <tr>
              <td />
              {headerRow}
            </tr>
          </thead>
          <tbody>{dataRows}</tbody>
        </table>
        {currentStateInfo}
      </div>
    );
  }
}

///////////////
// PropTypes //
///////////////

Spreadsheet.propTypes = {
  initialRows: PropTypes.number.isRequired,
  initialCols: PropTypes.number.isRequired
};

function jsonStringifyReplacer(key, value) {
  if (value instanceof Spreadsheet) {
    return undefined; // Ignore it.
  } else if (value instanceof Set) {
    return [...value];
  }

  return value;
}

export default Spreadsheet;
