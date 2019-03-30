import Util from "./util";
import "./set_functions";

class Cell {
  constructor(spreadsheet, ref) {
    // console.log(`Cell constructor called with ${arguments.length} arguments...`);

    if (arguments.length === 0) {
      return; // Alow cloning of (fully) empty cells.
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
    // console.log(`Cloning ${this.ref}...`);

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

  referencedBy(refs, visited = new Set()) {
    // console.log(`Visited: ${[...visited]}`)

    return (
      refs.size > 0 &&
      (refs.has(this.ref) ||
        [...refs].some(
          ref =>
            !visited.has(ref) &&
            this.referencedBy(this.cellAt(ref).observedCells, visited.add(ref))
        ))
    );
  }

  setValue(newValue) {
    if (newValue === this.value) {
      return;
    }

    if (
      Util.isFormula(newValue) &&
      this.referencedBy(Util.findRefsInFormula(newValue))
    ) {
      newValue = "[Cyclical Reference Error]";
    }

    this.value = newValue;
    this.refreshObservedCells();
    this.evaluate();

    this.touched = true;
  }

  evaluate() {
    const previousCalculatedValue =
      this.calculatedValue === undefined ? this.value : this.calculatedValue;
    let evaluatedValue;

    if (Util.isFormula(this.value)) {
      evaluatedValue = Util.removeAbsoluteReferences(
        Util.extractFormulaContents(this.value)
      );

      this.observedCells.forEach(ref => {
        const observedCell = this.cellAt(ref);
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

    // console.log(`After evaluating ${this.ref}: was '${previousCalculatedValue}', became '${evaluatedValue}'`);

    if (evaluatedValue !== previousCalculatedValue) {
      this.recalculated = true;
      this.touched = true;
      this.recalculateObservers();
    }
  }

  refreshObservedCells() {
    let previousObservedCells = new Set(this.observedCells); // Clone set, in order to compare/diff it later.
    let currentObservedCells = new Set();

    if (Util.isFormula(this.value)) {
      currentObservedCells = Util.findRefsInFormula(this.value);
      currentObservedCells.forEach(ref => this.addObservedCell(ref));
    }

    // Remove unreferenced cells.
    previousObservedCells
      .diff(currentObservedCells)
      .forEach(ref => this.removeObservedCell(ref));
  }

  addObservedCell(ref) {
    this.touched = true;
    this.observedCells.add(ref);
    this.cellAt(ref).addObserver(this.ref);
  }

  removeObservedCell(ref) {
    this.touched = true;
    this.observedCells.delete(ref);
    this.cellAt(ref).removeObserver(this.ref);
  }

  addObserver(ref) {
    this.touched = true;
    this.observerCells.add(ref);
  }

  removeObserver(ref) {
    this.touched = true;
    this.observerCells.delete(ref);
  }

  recalculateObservers() {
    this.observerCells.forEach(ref => this.cellAt(ref).evaluate());
  }

  cellAt(ref) {
    return this.spreadsheet.cellAt(ref);
  }
}

export default Cell;
