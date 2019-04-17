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
    this.touched = false;
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

  setValue(newValue, cells) {
    this.cellMightChange("setValue", cells, { newValue: newValue });

    const directAndIndirectObservers = this.spreadsheet.findDirectAndIndirectObservers(
      {
        ref: this.ref,
        cells
      }
    );

    if (String(newValue) === this.value) {
      return;
    }

    if (
      Util.isFormula(newValue) &&
      this.directlyOrIndirectlyReferencedBy({
        refs: Util.findRefsInFormula(newValue),
        cells
      })
    ) {
      newValue = "[Cyclical Reference Error]";
    }

    this.value = String(newValue);
    this.syncObservedCells(cells);
    this.evaluate({ directAndIndirectObservers, cells });

    this.touched = true;
  }

  getEvalContext() {
    // All formula builtin functions go here.
    const COUNT = refs => refs.flat().length;
    const SUM = refs => refs.flat().reduce((ref, acc) => acc + ref);
    const MULT = refs => refs.flat().reduce((ref, acc) => acc * ref);
    const AVG = refs => SUM(refs) / COUNT(refs);
    const MAX = refs => Math.max(...refs.flat());
    const MIN = refs => Math.min(...refs.flat());
    const ROWS = refs => refs.length;
    const COLS = refs => (refs.length === 0 ? 0 : refs[0].length);

    return code => eval(code);
  }

  evaluate({
    directAndIndirectObservers,
    cells,
    visited = new Set(),
    recalculateObservers = true
  }) {
    this.cellMightChange("evaluate", cells);

    const previousCalculatedValue =
      this.calculatedValue === undefined ? this.value : this.calculatedValue;
    let evaluatedValue;

    if (Util.isFormula(this.value)) {
      evaluatedValue = Util.removeAbsoluteReferences(
        Util.extractFormulaContents(this.value)
      );

      evaluatedValue = Util.expandAllRanges(evaluatedValue);

      this.observedCells.forEach(ref => {
        const observedCell = this.cellAt(ref, cells);

        // Observed cell with pending evaluation?
        if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
          // Evaluate it, but without recalculating its own obervers (which certalinly
          // includes the current cell).
          observedCell.evaluate({
            directAndIndirectObservers,
            cells,
            visited,
            recalculateObservers: false
          });
        }

        const observedCellCalculatedValue =
          observedCell && observedCell.calculatedValue;

        evaluatedValue = Util.replaceRefInFormula(
          evaluatedValue,
          ref,
          observedCellCalculatedValue
        );
      });

      try {
        // eslint-disable-next-line
        evaluatedValue = this.getEvalContext()(evaluatedValue);
      } catch (error) {
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

    if (evaluatedValue !== previousCalculatedValue) {
      this.recalculated = true;
      this.touched = true;

      if (recalculateObservers) {
        this.recalculateObservers(directAndIndirectObservers, cells, visited);
      }
    }
  }

  recalculateObservers(directAndIndirectObservers, cells, visited) {
    this.observerCells.forEach(ref => {
      if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
        // Why not simply use `if (!visited.has(ref))`???
        this.cellAt(ref, cells).evaluate({
          directAndIndirectObservers,
          cells,
          visited
        });
      }
    });
  }

  syncObservedCells(cells) {
    let previousObservedCells = new Set(this.observedCells); // Clone set, in order to compare/diff it later.
    let currentObservedCells = new Set();

    if (Util.isFormula(this.value)) {
      currentObservedCells = Util.findRefsInFormula(
        Util.expandAllRanges(this.value)
      );
      currentObservedCells.forEach(ref => this.addObservedCell(ref, cells));
    }

    // Remove unreferenced cells.
    previousObservedCells
      .diff(currentObservedCells)
      .forEach(ref => this.removeObservedCell(ref, cells));
  }

  addObservedCell(ref, cells) {
    this.cellMightChange("addObservedCell", cells);

    this.touched = this.touched || !this.observedCells.has(ref);
    this.observedCells.add(ref);
    this.cellAt(ref, cells).addObserverCell(this.ref, cells);
  }

  removeObservedCell(ref, cells) {
    this.cellMightChange("removeObservedCell", cells);

    this.touched = this.touched || this.observedCells.has(ref);
    this.observedCells.delete(ref);
    this.cellAt(ref, cells).removeObserverCell(this.ref, cells);
  }

  addObserverCell(ref, cells) {
    this.cellMightChange("addObserverCell", cells);

    this.touched = this.touched || !this.observerCells.has(ref);
    this.observerCells.add(ref);
  }

  removeObserverCell(ref, cells) {
    this.cellMightChange("removeObserverCell", cells);

    this.touched = this.touched || this.observerCells.has(ref);
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
