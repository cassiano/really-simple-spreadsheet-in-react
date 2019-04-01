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

  setValue(newValue, directAndIndirectObservers = new Set()) {
    if (String(newValue) === this.value) {
      return;
    }

    if (
      Util.isFormula(newValue) &&
      this.referencedBy(Util.findRefsInFormula(newValue))
    ) {
      newValue = "[Cyclical Reference Error]";
    }

    this.value = String(newValue);
    this.refreshObservedCells();
    this.evaluate(directAndIndirectObservers);

    this.touched = true;
  }

  evaluate(
    directAndIndirectObservers,
    visited = new Set(),
    recalculateObservers = true
  ) {
    // console.log(`Evaluating ${this.ref}...`);

    const previousCalculatedValue =
      this.calculatedValue === undefined ? this.value : this.calculatedValue;
    let evaluatedValue;

    if (Util.isFormula(this.value)) {
      evaluatedValue = Util.removeAbsoluteReferences(
        Util.extractFormulaContents(this.value)
      );

      this.observedCells.forEach(ref => {
        const observedCell = this.cellAt(ref);

        // Observed cell with pending evaluation?
        if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
          // console.log(`Evaluation of ${ref} pending!`);
          
          // Evaluate it, but without recalculating its own obervers (which certalinly
          // includes the current cell).
          observedCell.evaluate(directAndIndirectObservers, visited, false);
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

    // console.log(`evaluate: ${this.ref} marked as visited.`);

    // console.log(
    //   `After evaluating ${
    //     this.ref
    //   }: was '${previousCalculatedValue}', became '${evaluatedValue}'`
    // );

    if (evaluatedValue !== previousCalculatedValue) {
      this.recalculated = true;
      this.touched = true;

      if (recalculateObservers) {
        this.recalculateObservers(directAndIndirectObservers, visited);
      }
    }
  }

  recalculateObservers(directAndIndirectObservers, visited) {
    this.observerCells.forEach(ref => {
      if (directAndIndirectObservers.has(ref) && !visited.has(ref)) {
        this.cellAt(ref).evaluate(directAndIndirectObservers, visited);
      }
    });
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

  cellAt(refOrRowCol) {
    return this.spreadsheet.cellAt(refOrRowCol);
  }
}

export default Cell;
