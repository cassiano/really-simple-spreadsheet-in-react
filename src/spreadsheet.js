import React from "react";
import Util from "./util";
import Cell from "./cell";
import CellVisualizer from "./cell_visualizer";
import PropTypes from "prop-types";
import "./set_functions";
import findLastIndex from "ramda/es/findLastIndex";

class Spreadsheet extends React.Component {
  static DEBUG = true;

  constructor(props) {
    super(props);

    const cells = Array(props.initialRows)
      .fill()
      .map((_, row) =>
        Array(props.initialCols)
          .fill()
          .map((_, col) => new Cell(this, [row, col]))
      );

    this.state = {
      editMode: true,
      cells: cells
    };
  }

  componentDidMount() {
    this.setState(state => {
      this.clonedCells = state.cells.map(row => row.map(cell => cell.clone()));

      // // Spiral Fibonacci.
      // this.fillSpiral("A1", "E6", (index, ref, visitedCells) =>
      //   index < 2 ? 1 : `=${visitedCells[index - 2]}+${visitedCells[index - 1]}`
      // );

      // // Spiral Factorial.
      // this.fillSpiral("A8", "E13", (index, ref, visitedCells) =>
      //   index < 1 ? 1 : `=${index + 1}*${visitedCells[index - 1]}`
      // );

      // Spiral with random references.
      this.fillSpiral("A1", "D8", (index, ref, visitedCells) => {
        if (index === 0) {
          return 1;
        } else {
          const refCellsSize = Math.min(
            1 + Math.floor(Math.random() * index),
            Math.trunc(Math.sqrt(index))
          );
          const refCells = [...Array(refCellsSize)].map(
            () => visitedCells[Math.floor(Math.random() * visitedCells.length)]
          );
          const randomMathOperation = () =>
            ["+", "-"][Math.trunc(Math.random() * 2)];

          const formula = refCells.reduce(
            (acc, cell) => acc + `${randomMathOperation()}${cell}`,
            `=${index + 1}`
          );

          return formula;
        }
      });

      // // Generalized "Fibonacci".
      // const previousElementsToAdd = 20;

      // this.fillSpiral("A1", "D100", (index, ref, visitedCells) =>
      //   index < previousElementsToAdd ? 1 : '=' + [...Array(previousElementsToAdd)].map((_, i) => visitedCells[index - (i + 1)]).join('+')
      // );

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

    for (let col = borderTopLeftCol + 1; col < borderBottomRightCol; col++) {
      this.cellAt([borderTopLeftRow, col], this.clonedCells).setValue("━━━━");
      this.cellAt([borderBottomRightRow, col], this.clonedCells).setValue(
        "━━━━"
      );
    }

    for (let row = borderTopLeftRow + 1; row < borderBottomRightRow; row++) {
      this.cellAt([row, borderTopLeftCol], this.clonedCells).setValue("┃");
      this.cellAt([row, borderBottomRightCol], this.clonedCells).setValue("┃");
    }

    this.cellAt(borderTopLeft, this.clonedCells).setValue("┏");
    this.cellAt(
      [borderTopLeftRow, borderBottomRightCol],
      this.clonedCells
    ).setValue("┓");
    this.cellAt(borderBottomRight, this.clonedCells).setValue("┛");
    this.cellAt(
      [borderBottomRightRow, borderTopLeftCol],
      this.clonedCells
    ).setValue("┗");

    const directions = {
      right: {
        row: idx => idx,
        col: idx => idx + 1,
        turn: { right: "down", left: "up" }
      },
      down: {
        row: idx => idx + 1,
        col: idx => idx,
        turn: { right: "left", left: "right" }
      },
      left: {
        row: idx => idx,
        col: idx => idx - 1,
        turn: { right: "up", left: "down" }
      },
      up: {
        row: idx => idx - 1,
        col: idx => idx,
        turn: { right: "right", left: "left" }
      }
    };

    const walk = (direction, row, col) => [
      directions[direction].row(row),
      directions[direction].col(col)
    ];

    let visitedCells = [];
    let direction = "down";
    let cell = this.cellAt(
      [borderTopLeftRow + 1, borderTopLeftCol + 1],
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
          : this.cellAt([row, col], this.clonedCells);

      // Did we reach the border?
      if (nextCell && nextCell.value === "") {
        // No. Keep walking in the same direction.
        cell = nextCell;
      } else {
        // Yes! Backup one step, turn right and walk again.
        direction = directions[direction].turn.left;

        cell = this.cellAt(
          walk(direction, previousRow, previousCol),
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

  cellAt(refOrRowCol, cells = this.clonedCells) {
    const [row, col] =
      refOrRowCol instanceof Array
        ? refOrRowCol
        : Util.rowColFromRef(refOrRowCol);

    if (
      row >= Spreadsheet.rows(cells) ||
      col >= Spreadsheet.cols(cells) ||
      !cells[row] ||
      !cells[row][col]
    ) {
      cells[row] = cells[row] || [];
      cells[row][col] = new Cell(this, [row, col]);

      // Fill blank cells.
      for (let r = 0; r < Spreadsheet.rows(cells); r++) {
        cells[r] = cells[r] || [];

        for (let c = 0; c < Spreadsheet.cols(cells); c++) {
          if (!cells[r][c]) {
            cells[r][c] = new Cell(this, [r, c]);
          }
        }
      }
    }

    return cells[row][col];
  }

  detectAffectedCells(cells, currentCell, value, directAndIndirectObservers) {
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
    affectedCells.concat(directAndIndirectObservers);

    return affectedCells;
  }

  findDirectAndIndirectObservers(ref, cells, visited = new Set()) {
    // console.log(`findDirectAndIndirectObservers: checking ${ref}...`);

    visited.add(ref);

    const observers = this.cellAt(ref, cells).observerCells;

    if (observers.size === 0) {
      return new Set();
    }

    const observersOfObservers = [...observers].reduce(
      (acc, ref2) =>
        visited.has(ref2)
          ? acc
          : acc.concat(
              this.findDirectAndIndirectObservers(ref2, cells, visited)
            ),
      new Set()
    );

    return new Set(observers).concat(observersOfObservers);
  }

  handleBlur(event, row, col) {
    const value = event.target.value;

    // Keep current state if nothing changed.
    if (this.state.cells[row][col].value === value) {
      return;
    }

    this.setState((state, props) => {
      const currentCell = state.cells[row][col];

      const directAndIndirectObservers = this.findDirectAndIndirectObservers(
        currentCell.ref,
        state.cells
      );

      // console.log(
      //   `directAndIndirectObservers: ${[...directAndIndirectObservers]}`
      // );

      const affectedCells = this.detectAffectedCells(
        state.cells,
        currentCell,
        value,
        directAndIndirectObservers
      );

      // console.log(`affectedCells: ${[...affectedCells]}`);

      // Clone only previously recalculated, touched or (possibly) affected cells.
      this.clonedCells = state.cells.map(row =>
        row.map(cell =>
          cell.recalculated || cell.touched || affectedCells.has(cell.ref)
            ? cell.clone({ recalculated: false, touched: false })
            : cell
        )
      );

      const currentClonedCell = this.clonedCells[row][col];

      currentClonedCell.setValue(value, directAndIndirectObservers);

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
              editMode={this.state.editMode}
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
        <label>
          Hide inputs
          <input
            type="checkbox"
            checked={!this.state.editMode}
            onChange={e => this.setState({ editMode: !e.target.checked })}
          />
        </label>
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
