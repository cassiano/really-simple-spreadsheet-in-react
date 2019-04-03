import Util from "./util";
import "./set_functions";

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
    this.observedCells = new Set();
    this.observerCells = new Set();
    this.recalculated = false;
    this.touched = false;
    this.evaluate();
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

  directlyOrIndirectlyReferencedBy(refs, cells, visited = new Set()) {
    return (
      refs.size > 0 &&
      (refs.has(this.ref) ||
        [...refs].some(
          ref =>
            !visited.has(ref) &&
            this.directlyOrIndirectlyReferencedBy(
              this.cellAt(ref, cells).observedCells,
              cells,
              visited.add(ref)
            )
        ))
    );
  }

  setValue(newValue, cells, directAndIndirectObservers = new Set()) {
    this.cellWillBeChanged("setValue", cells, { newValue: newValue });

    if (String(newValue) === this.value) {
      return;
    }

    if (
      Util.isFormula(newValue) &&
      this.directlyOrIndirectlyReferencedBy(
        Util.findRefsInFormula(newValue),
        cells
      )
    ) {
      newValue = "[Cyclical Reference Error]";
    }

    this.value = String(newValue);
    this.refreshObservedCells(cells);
    this.evaluate(directAndIndirectObservers, cells);

    this.touched = true;
  }

  evaluate(
    directAndIndirectObservers,
    cells,
    visited = new Set(),
    recalculateObservers = true
  ) {
    this.cellWillBeChanged("evaluate", cells);

    const previousCalculatedValue =
      this.calculatedValue === undefined ? this.value : this.calculatedValue;
    let evaluatedValue;

    if (Util.isFormula(this.value)) {
      evaluatedValue = Util.removeAbsoluteReferences(
        Util.extractFormulaContents(this.value)
      );

      this.observedCells.forEach(ref => {
        const observedCell = this.cellAt(ref, cells);

        // Observed cell with pending evaluation?
        if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
          // Evaluate it, but without recalculating its own obervers (which certalinly
          // includes the current cell).
          observedCell.evaluate(
            directAndIndirectObservers,
            cells,
            visited,
            false
          );
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
        evaluatedValue = eval(evaluatedValue);
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
        this.cellAt(ref, cells).evaluate(
          directAndIndirectObservers,
          cells,
          visited
        );
      }
    });
  }

  refreshObservedCells(cells) {
    let previousObservedCells = new Set(this.observedCells); // Clone set, in order to compare/diff it later.
    let currentObservedCells = new Set();

    if (Util.isFormula(this.value)) {
      currentObservedCells = Util.findRefsInFormula(this.value);
      currentObservedCells.forEach(ref => this.addObservedCell(ref, cells));
    }

    // Remove unreferenced cells.
    previousObservedCells
      .diff(currentObservedCells)
      .forEach(ref => this.removeObservedCell(ref, cells));
  }

  addObservedCell(ref, cells) {
    this.cellWillBeChanged("addObservedCell", cells);

    this.touched = true;
    this.observedCells.add(ref);
    this.cellAt(ref, cells).addObserver(this.ref, cells);
  }

  removeObservedCell(ref, cells) {
    this.cellWillBeChanged("removeObservedCell", cells);

    this.touched = true;
    this.observedCells.delete(ref);
    this.cellAt(ref, cells).removeObserver(this.ref, cells);
  }

  addObserver(ref, cells) {
    this.cellWillBeChanged("addObserver", cells);

    this.touched = true;
    this.observerCells.add(ref);
  }

  removeObserver(ref, cells) {
    this.cellWillBeChanged("removeObserver", cells);

    this.touched = true;
    this.observerCells.delete(ref);
  }

  cellAt(refOrRowCol, cells) {
    return this.spreadsheet.cellAt(refOrRowCol, cells);
  }

  cellWillBeChanged(caller, cells, attrs = {}) {
    if (this.spreadsheet.state && this.spreadsheet.state.cells) {
      console.assert(
        cells !== this.spreadsheet.state.cells &&
        (!this.spreadsheet.cellExists(
          this.ref,
          this.spreadsheet.state.cells
        ) ||
          this.cellAt(this.ref, this.spreadsheet.state.cells) !== this),
        {
          message:
            `${caller}: Cells values should never be modified directly in the state`,
          ref: this.ref,
        ...attrs
        }
      );
    }
  }
}

export default Cell;
