import Util from "./util";
import "./set_functions";
import Spreadsheet from "./spreadsheet";

class Cell {
  constructor(spreadsheet, refOrRowCol) {
    const ref =
      refOrRowCol instanceof Array ? Util.asRef(...refOrRowCol) : refOrRowCol;

    // Alow cloning of (fully) empty cells.
    if (arguments.length === 0) {
      return;
    }

    this.spreadsheet = spreadsheet;
    this.ref = ref;
    this.value = "";
    this.calculatedValue = "";
    this.observedCells = new Set();
    this.observerCells = new Set();
    this.recalculated = false;
    this.refsChanged = false;
    this.invalidFormula = false;
  }

  clone(attrsToMerge = {}) {
    let clonedObject = new Cell();

    // Copy all object properties, including inherited ones (if applicable), cloning sets as necessary.
    for (let prop in this) {
      clonedObject[prop] =
        this[prop] instanceof Set ? new Set(this[prop]) : this[prop];
    }

    for (let prop in attrsToMerge) {
      clonedObject[prop] = attrsToMerge[prop];
    }

    return clonedObject;
  }

  directlyOrIndirectlyReferencedBy({ refs, cells, visited = new Set() }) {
    return (
      refs.size > 0 &&
      (refs.has(this.ref) ||
        [...refs].some(
          ref =>
            !visited.has(ref) &&
            this.directlyOrIndirectlyReferencedBy({
              refs: this.cellAt(ref, cells).observedCells,
              cells,
              visited: visited.add(ref)
            })
        ))
    );
  }

  setValue(newValue, cells, force = false) {
    this.cellMightChange("setValue", cells, { newValue: newValue });

    // Return immediatly if no changes.
    if (!force && String(newValue) === this.value) {
      return;
    }

    // Assume any formula (if present) is valid.
    this.invalidFormula = false;

    const directAndIndirectObservers = this.spreadsheet.findDirectAndIndirectObservers(
      {
        ref: this.ref,
        cells
      }
    );

    if (
      Util.isFormula(newValue) &&
      this.directlyOrIndirectlyReferencedBy({
        refs: Util.findRefsInFormula({ formula: newValue }),
        cells
      })
    ) {
      this.calculatedValue = "[Cyclical Reference Error]";
      this.invalidFormula = true;
    }

    this.value = String(newValue);

    this.syncObservedCells(directAndIndirectObservers, cells);

    if (!this.invalidFormula) {
      this.evaluate({ directAndIndirectObservers, cells });
    }
  }

  getEvalContext() {
    // All formula builtin functions go here.
    /* eslint-disable no-unused-vars */
    const COUNT = (...cells) => cells.flat(2).length;
    const SUM = (...cells) => cells.flat(2).reduce((cell, acc) => acc + cell);
    const MULT = (...cells) => cells.flat(2).reduce((cell, acc) => acc * cell);
    const AVG = (...cells) => SUM(...cells) / COUNT(...cells);
    const MAX = (...cells) => Math.max(...cells.flat(2));
    const MIN = (...cells) => Math.min(...cells.flat(2));
    const ROWS = (...cells) => cells[0].length;
    const COLS = (...cells) => (cells[0].length === 0 ? 0 : cells[0][0].length);
    const IF = (condition, thenExpr, elseExpr = "") =>
      condition ? thenExpr : elseExpr;
    const NULLIF = (cell1, cell2) => (cell1 === cell2 ? "" : cell1);
    const IFNULLORZERO = (cell, defaultValue) =>
      cell === "" || cell === 0 ? defaultValue : cell;
    /* eslint-enable no-unused-vars */

    return code => eval(code); // eslint-disable-line no-eval
  }

  evaluate({
    directAndIndirectObservers,
    cells,
    visited = new Set(),
    recalculateObservers = true
  }) {
    this.cellMightChange("evaluate", cells);

    // console.log(`Evaluating ${this.ref}...`);

    // Assume any formula (if present) is valid.
    this.invalidFormula = false;

    const previousCalculatedValue =
      this.calculatedValue === undefined ? this.value : this.calculatedValue;
    let evaluatedValue;

    if (Util.isFormula(this.value)) {
      evaluatedValue = Util.removeAbsoluteReferences(this.value);
      evaluatedValue = Util.expandRanges(evaluatedValue);

      this.observedCells.forEach(ref => {
        const observedCell = this.cellAt(ref, cells);

        // Is this cell (pointed to by `ref`) subject to change and is pending evaluation?
        if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
          // Evaluate it, but without recalculating its own observers (which certalinly includes the current cell).
          observedCell.evaluate({
            directAndIndirectObservers,
            cells,
            visited,
            recalculateObservers: false
          });
        }

        evaluatedValue = Util.replaceRefInFormula(
          evaluatedValue,
          ref,
          observedCell.calculatedValue
        );
      });

      try {
        // console.log(`About to evaluate ${this.ref} with value '${evaluatedValue}'`);

        evaluatedValue = this.getEvalContext()(
          Util.extractFormulaContents(evaluatedValue)
        );
      } catch (error) {
        this.invalidFormula = true;

        evaluatedValue = this.value;
      }
    } else {
      evaluatedValue = this.value;
    }

    this.calculatedValue = evaluatedValue;

    visited.add(this.ref);

    // console.log(
    //   `After evaluating ${
    //     this.ref
    //   }: was '${previousCalculatedValue}', became '${evaluatedValue}'`
    // );

    if (String(evaluatedValue) !== String(previousCalculatedValue)) {
      this.recalculated = true;

      if (recalculateObservers) {
        this.recalculateObservers(directAndIndirectObservers, cells, visited);
      }
    }
  }

  recalculateObservers(directAndIndirectObservers, cells, visited) {
    this.observerCells.forEach(ref => {
      if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
        this.cellAt(ref, cells).evaluate({
          directAndIndirectObservers,
          cells,
          visited
        });
      }
    });
  }

  syncObservedCells(directAndIndirectObservers, cells) {
    let previousObservedCells = new Set(this.observedCells); // Clone set, in order to compare/diff it later.
    let currentObservedCells = new Set();

    if (Util.isFormula(this.value)) {
      currentObservedCells = Util.findRefsInFormula({ formula: this.value });

      // Add new cells.
      currentObservedCells
        .diff(previousObservedCells)
        .forEach(ref => this.addObservedCell(ref, cells));
    }

    // Remove old cells.
    previousObservedCells
      .diff(currentObservedCells)
      .forEach(ref =>
        this.removeObservedCell(ref, cells, directAndIndirectObservers)
      );
  }

  addObservedCell(ref, cells) {
    this.cellMightChange("addObservedCell", cells);

    this.refsChanged = this.refsChanged || !this.observedCells.has(ref);
    this.observedCells.add(ref);
    this.cellAt(ref, cells).addObserverCell(this.ref, cells);
  }

  removeObservedCell(ref, cells, directAndIndirectObservers) {
    this.cellMightChange("removeObservedCell", cells);

    const cell = this.cellAt(ref, cells);

    this.refsChanged = this.refsChanged || this.observedCells.has(ref);
    this.observedCells.delete(ref);
    cell.removeObserverCell(this.ref, cells);

    if (cell.invalidFormula) {
      cell.setValue(cell.value, cells, true);
    }
  }

  addObserverCell(ref, cells) {
    this.cellMightChange("addObserverCell", cells);

    this.refsChanged = this.refsChanged || !this.observerCells.has(ref);
    this.observerCells.add(ref);
  }

  removeObserverCell(ref, cells) {
    this.cellMightChange("removeObserverCell", cells);

    this.refsChanged = this.refsChanged || this.observerCells.has(ref);
    this.observerCells.delete(ref);
  }

  cellAt(refOrRowCol, cells) {
    return this.spreadsheet.cellAt(refOrRowCol, cells);
  }

  cellMightChange(caller, cells, attrs = {}) {
    if (Spreadsheet.CHECK_ASSERTIONS) {
      if (this.spreadsheet.state && this.spreadsheet.state.cells) {
        console.assert(
          cells !== this.spreadsheet.state.cells &&
            (!this.spreadsheet.cellExists(
              this.ref,
              this.spreadsheet.state.cells
            ) ||
              this.cellAt(this.ref, this.spreadsheet.state.cells) !== this),
          {
            message: `${caller}: Cells values should never be modified directly in the state`,
            ref: this.ref,
            ...attrs
          }
        );
      }
    }
  }
}

export default Cell;
