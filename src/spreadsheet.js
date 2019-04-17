import React from "react";
import Util from "./util";
import Cell from "./cell";
import CellVisualizer from "./cell_visualizer";
import PropTypes from "prop-types";
import "./set_functions";

class Spreadsheet extends React.Component {
  static DISPLAY_STATE = true;
  static CHECK_ASSERTIONS = true;

  constructor(props) {
    super(props);

    const initialCells = Array(props.initialRows)
      .fill()
      .map((_, row) =>
        Array(props.initialCols)
          .fill()
          .map((_, col) => new Cell(this, [row, col]))
      );

    this.state = {
      editMode: true,
      cellInputSize: 10,
      cells: initialCells
    };
  }

  componentDidMount() {
    this.setState(state => {
      let clonedCells = state.cells.map(row => row.map(cell => cell.clone()));

      // // Spiral Fibonacci.
      // this.fillSpiral("A1", "E6", (index, ref, visitedCells) =>
      //   index < 2 ? 1 : `=${visitedCells[index - 2]}+${visitedCells[index - 1]}`
      // );

      // // Spiral Factorial.
      // this.fillSpiral("A8", "E13", (index, ref, visitedCells) =>
      //   index < 1 ? 1 : `=${index + 1}*${visitedCells[index - 1]}`
      // );

      // // Spiral with random references.
      // this.fillSpiral({
      //   borderTopLeft: "A1",
      //   borderBottomRight: "E30",
      //   cells: clonedCells,
      //   valueFn: (index, ref, visitedCells) => {
      //     if (index === 0) {
      //       return 1;
      //     } else {
      //       const refCellsSize = Math.min(
      //         1 + Math.floor(Math.random() * index),
      //         Math.trunc(Math.sqrt(index))
      //       );
      //       const refCells = [...Array(refCellsSize)].map(
      //         () =>
      //           visitedCells[Math.floor(Math.random() * visitedCells.length)]
      //       );
      //       const randomMathOperation = () =>
      //         ["+", "-"][Math.trunc(Math.random() * 2)];

      //       const formula = refCells.reduce(
      //         (acc, cell) => acc + `${randomMathOperation()}${cell}`,
      //         `=${index + 1}`
      //       );

      //       return formula;
      //     }
      //   }
      // });

      // // Generalized "Fibonacci".
      // const previousElementsToAdd = 2;

      // this.fillSpiral({
      //   borderTopLeft: "A1",
      //   borderBottomRight: "H10",
      //   cells: clonedCells,
      //   valueFn: (index, ref, visitedCells) =>
      //     index < previousElementsToAdd
      //       ? 1
      //       : "=" +
      //         [...Array(previousElementsToAdd)]
      //           .map((_, i) => visitedCells[index - (i + 1)])
      //           .join("+")
      // });

      // this.cellAt("A1", clonedCells).setValue(1, clonedCells);
      // this.cellAt("A2", clonedCells).setValue(2, clonedCells);
      // this.cellAt("A3", clonedCells).setValue(3, clonedCells);
      // this.cellAt("A4", clonedCells).setValue(4, clonedCells);
      // this.cellAt("A5", clonedCells).setValue("=A1+$A2+A$3+$A$4", clonedCells);
      // this.copyCellToRange("A5", "A6:A10", clonedCells);
      // this.copyRangeToRange("A1:A10", "B1:Z10", clonedCells);

      // this.cellAt("A1", clonedCells).setValue(1, clonedCells);
      // this.cellAt("A2", clonedCells).setValue(1, clonedCells);
      // this.cellAt("A3", clonedCells).setValue("=A1+A2", clonedCells);
      // this.copyCellToRange("A3", "A4:A10", clonedCells);
      // this.copyRangeToRange("A1:A10", "B1:B10", clonedCells);

      this.cellAt("A1", clonedCells).setValue(1, clonedCells);
      this.cellAt("A2", clonedCells).setValue(2, clonedCells);
      this.cellAt("A3", clonedCells).setValue(3, clonedCells);
      this.cellAt("A4", clonedCells).setValue(4, clonedCells);
      this.cellAt("B1", clonedCells).setValue(5, clonedCells);
      this.cellAt("B2", clonedCells).setValue(6, clonedCells);
      this.cellAt("B3", clonedCells).setValue(7, clonedCells);
      this.cellAt("B4", clonedCells).setValue(8, clonedCells);
      this.cellAt("A5", clonedCells).setValue("=SUM(A1:B4)", clonedCells);
      this.cellAt("A6", clonedCells).setValue("=AVG(A1:B4)", clonedCells);
      this.cellAt("A7", clonedCells).setValue("=MULT(A1:B4)", clonedCells);
      this.cellAt("A8", clonedCells).setValue("=COUNT(A1:B4)", clonedCells);
      this.cellAt("A9", clonedCells).setValue("=MAX(A1:B4)", clonedCells);
      this.cellAt("A10", clonedCells).setValue("=MIN(A1:B4)", clonedCells);
      this.cellAt("A11", clonedCells).setValue("=ROWS(A1:B4)", clonedCells);
      this.cellAt("A12", clonedCells).setValue("=COLS(A1:B4)", clonedCells);

      return { cells: clonedCells };
    });
  }

  // moveCell(fromRef, toRef, cells) {
  //   const fromCell = this.cellAt(fromRef, cells);
  //   const toCell = this.cellAt(toRef, cells);

  //   fromCell.observers.forEach(ref => {
  //     let observer = this.cellAt(ref, cells);

  //     # TODO
  //   });
  // }

  copyCell(fromRef, toRef, cells) {
    const fromCell = this.cellAt(fromRef, cells);
    const toCell = this.cellAt(toRef, cells);

    if (Util.isFormula(fromCell.value)) {
      let targetFormula = fromCell.value;

      Util.findRefsInFormula(fromCell.value, false).forEach(ref => {
        let targetRef = Util.addRowsColsToRef(
          ref,
          ...Util.refsDistance(fromRef, toRef)
        );

        // Include '<' and '>' markers around all replaced cell references, so they don't get replaced more than once.
        targetFormula = targetFormula.replace(
          new RegExp(
            `(?<![a-zA-Z])(?<!<)${ref.replace("$", "[$]")}(?!>)(?!\d)`,
            "gi"
          ),
          `<${targetRef}>`
        );
      });

      // Now we get rid of the markers.
      targetFormula = targetFormula.replace(/<(\$?[a-zA-Z]+\$?\d+)>/g, "$1");

      toCell.setValue(targetFormula, cells);
    } else {
      toCell.setValue(fromCell.value, cells);
    }
  }

  copyRangeToCell(fromRange, toRef, cells) {
    // TODO
  }

  copyRangeToRange(fromRange, toRange, cells) {
    const fromRangeCells = Util.expandRange(fromRange).flat();
    const toRangeCells = Util.expandRange(toRange).flat();
    const commonCells = new Set(fromRangeCells).intersection(
      new Set(toRangeCells)
    );

    if (commonCells.size > 0) {
      throw `copyRangeToRange: ranges cannot overlap (cells in common: ${[
        ...commonCells
      ]})`;
    }

    const refs = {
      fromRange: fromRange.split(":"),
      toRange: toRange.split(":")
    };
    const refsCoords = {
      fromRange: {
        topLeft: Util.rowColFromRef(refs.fromRange[0]),
        bottomRight: Util.rowColFromRef(refs.fromRange[1])
      },
      toRange: {
        topLeft: Util.rowColFromRef(refs.toRange[0]),
        bottomRight: Util.rowColFromRef(refs.toRange[1])
      }
    };
    const rowsWidth = {
      fromRange:
        refsCoords.fromRange.bottomRight.row -
        refsCoords.fromRange.topLeft.row +
        1,
      toRange:
        refsCoords.toRange.bottomRight.row - refsCoords.toRange.topLeft.row + 1
    };
    const colsWidth = {
      fromRange:
        refsCoords.fromRange.bottomRight.col -
        refsCoords.fromRange.topLeft.col +
        1,
      toRange:
        refsCoords.toRange.bottomRight.col - refsCoords.toRange.topLeft.col + 1
    };

    for (
      let row = refsCoords.toRange.topLeft.row;
      row <= refsCoords.toRange.bottomRight.row;
      row += rowsWidth.fromRange
    ) {
      for (
        let col = refsCoords.toRange.topLeft.col;
        col <= refsCoords.toRange.bottomRight.col;
        col += colsWidth.fromRange
      ) {
        const targetRangeBottomRightCoords = {
          row: row + rowsWidth.fromRange - 1,
          col: col + colsWidth.fromRange - 1
        };

        if (
          targetRangeBottomRightCoords.row >
            refsCoords.toRange.bottomRight.row ||
          targetRangeBottomRightCoords.col > refsCoords.toRange.bottomRight.col
        ) {
          break; // Target shape wouldn't fit.
        }

        for (let innerRow = 0; innerRow < rowsWidth.fromRange; innerRow++) {
          for (let innerCol = 0; innerCol < colsWidth.fromRange; innerCol++) {
            this.copyCell(
              Util.addRowsColsToRef(refs.fromRange[0], innerRow, innerCol),
              Util.addRowsColsToRef(Util.asRef(row, col), innerRow, innerCol),
              cells
            );
          }
        }
      }
    }
  }

  copyCellToRange(fromRef, toRange, cells) {
    this.copyRangeToRange([fromRef, fromRef].join(":"), toRange, cells);
  }

  fillSpiral({ borderTopLeft, borderBottomRight, cells, valueFn }) {
    const { row: borderTopLeftRow, col: borderTopLeftCol } = Util.rowColFromRef(
      borderTopLeft
    );
    const {
      row: borderBottomRightRow,
      col: borderBottomRightCol
    } = Util.rowColFromRef(borderBottomRight);

    for (let col = borderTopLeftCol + 1; col < borderBottomRightCol; col++) {
      this.cellAt([borderTopLeftRow, col], cells).setValue("━━━━", cells);
      this.cellAt([borderBottomRightRow, col], cells).setValue("━━━━", cells);
    }

    for (let row = borderTopLeftRow + 1; row < borderBottomRightRow; row++) {
      this.cellAt([row, borderTopLeftCol], cells).setValue("┃", cells);
      this.cellAt([row, borderBottomRightCol], cells).setValue("┃", cells);
    }

    this.cellAt(borderTopLeft, cells).setValue("┏", cells);
    this.cellAt([borderTopLeftRow, borderBottomRightCol], cells).setValue(
      "┓",
      cells
    );
    this.cellAt(borderBottomRight, cells).setValue("┛", cells);
    this.cellAt([borderBottomRightRow, borderTopLeftCol], cells).setValue(
      "┗",
      cells
    );

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
    let cell = this.cellAt([borderTopLeftRow + 1, borderTopLeftCol + 1], cells);
    let nextCell, row, col, previousRow, previousCol;
    let index = 0;

    while (true) {
      ({ row, col } = Util.rowColFromRef(cell.ref));

      if (cell.value !== "") {
        break;
      }

      cell.setValue(valueFn(index, cell.ref, visitedCells), cells);

      visitedCells = visitedCells.concat(cell.ref);

      [previousRow, previousCol] = [row, col];

      // Walk!
      [row, col] = walk(direction, row, col);

      // Did we reach the spreadsheet boundaries?
      nextCell =
        row < 0 || col < 0 ? undefined : this.cellAt([row, col], cells);

      // Did we reach the border?
      if (nextCell && nextCell.value === "") {
        // No. Keep walking in the same direction.
        cell = nextCell;
      } else {
        // Yes! Backup one step, turn right and walk again.
        direction = directions[direction].turn.left;

        cell = this.cellAt(walk(direction, previousRow, previousCol), cells);
      }

      index++;
    }
  }

  static rows(cells) {
    return cells.length;
  }

  static cols(cells) {
    return Math.max(...cells.filter(row => Boolean).map(row => row.length)); // Ignore empty rows.
  }

  cellExists(refOrRowCol, cells) {
    const { row, col } =
      refOrRowCol instanceof Array
        ? { row: refOrRowCol[0], col: refOrRowCol[1] }
        : Util.rowColFromRef(refOrRowCol);

    return (
      row < Spreadsheet.rows(cells) &&
      col < Spreadsheet.cols(cells) &&
      cells[row] &&
      cells[row][col] instanceof Cell
    );
  }

  cellAt(refOrRowCol, cells) {
    const { row, col } =
      refOrRowCol instanceof Array
        ? { row: refOrRowCol[0], col: refOrRowCol[1] }
        : Util.rowColFromRef(refOrRowCol);

    if (!this.cellExists(refOrRowCol, cells)) {
      if (Spreadsheet.CHECK_ASSERTIONS) {
        if (this.state && this.state.cells) {
          console.assert(cells !== this.state.cells, {
            message:
              "cellAt: New cells should never be created directly in the state",
            ref: refOrRowCol
          });
        }
      }

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

    return cells[row] && cells[row][col];
  }

  detectAffectedCells({ targetCell, newValue, cells }) {
    const directAndIndirectObservers = this.findDirectAndIndirectObservers({
      ref: targetCell.ref,
      cells: cells
    });

    let formulaRefs = Util.isFormula(newValue)
      ? Util.findRefsInFormula(newValue)
      : new Set();
    let removedRefs = targetCell.observedCells.diff(formulaRefs);

    let affectedCells = new Set([targetCell.ref]); // Own cell is *always* affected, of course!
    affectedCells.concat(formulaRefs); // All observed cells will be affected.
    affectedCells.concat(removedRefs); // As will be all removed cells (from the formula).
    affectedCells.concat(directAndIndirectObservers); // And finally, all direct and indirect observers.

    return affectedCells;
  }

  findDirectAndIndirectObservers({ ref, cells, visited = new Set() }) {
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
              this.findDirectAndIndirectObservers({
                ref: ref2,
                cells: cells,
                visited: visited
              })
            ),
      new Set()
    );

    return new Set(observers).concat(observersOfObservers);
  }

  handleBlur(event, row, col, previousValue) {
    const value = event.target.value;

    // Keep current state if nothing changed.
    if (previousValue === value) {
      return;
    }

    this.setState((state, props) => {
      const currentCell = this.cellAt([row, col], state.cells);

      const affectedCells = this.detectAffectedCells({
        targetCell: currentCell,
        newValue: value,
        cells: state.cells
      });

      // Clone only previously recalculated, touched or (possibly) affected cells.
      let clonedCells = state.cells.map(row =>
        row.map(cell =>
          cell.recalculated || cell.touched || affectedCells.has(cell.ref)
            ? cell.clone({ recalculated: false, touched: false })
            : cell
        )
      );

      const currentClonedCell = clonedCells[row][col];

      currentClonedCell.setValue(value, clonedCells);

      return { cells: clonedCells };
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
              cell={this.cellAt([row, col], this.state.cells)}
              cols={numCols}
              rows={numRows}
              index={col + row * numCols + 1}
              onBlur={(e, previousValue) =>
                this.handleBlur(e, row, col, previousValue)
              }
              editMode={this.state.editMode}
              inputSize={this.state.cellInputSize}
            />
          </td>
        ))}
      </tr>
    ));

    let currentStateInfo;

    if (Spreadsheet.DISPLAY_STATE) {
      currentStateInfo = (
        <pre>
          Spreadsheet: {JSON.stringify(this.state, jsonStringifyReplacer, 2)}
        </pre>
      );
    }

    return (
      <div>
        <label>
          Hide inputs?
          <input
            type="checkbox"
            checked={!this.state.editMode}
            onChange={e => this.setState({ editMode: !e.target.checked })}
          />
        </label>
        <br />
        <label>
          Cell input size:
          <input
            type="text"
            size="3"
            value={this.state.cellInputSize}
            onChange={e => this.setState({ cellInputSize: e.target.value })}
          />
          <div id="slider" />
        </label>
        <hr />
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
