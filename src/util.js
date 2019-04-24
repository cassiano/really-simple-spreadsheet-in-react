class Util {
  static ALPHABET_LENGTH = "Z".charCodeAt() - "A".charCodeAt() + 1;

  // Converts 'A' to 0, 'B' to 1... 'Z' to 25.
  static colIndexFromSingleRef(colSingleRef) {
    return colSingleRef.charCodeAt() - "A".charCodeAt();
  }

  // Converts 'A' to 0, 'B' to 1... 'Z' to 25, 'AA' to 26 etc
  static colIndexFromRef(colRef) {
    return (
      colRef.split("").reduce(function(memo, letter, i) {
        return (
          memo +
          (Util.colIndexFromSingleRef(letter) + 1) *
            Util.ALPHABET_LENGTH ** (colRef.length - i - 1)
        );
      }, 0) - 1
    );
  }

  // Converts 0 to 'A', 1 to 'B'... 25 to 'Z'.
  static colSingleRef(colIndex) {
    return String.fromCharCode(colIndex + "A".charCodeAt(0));
  }

  // Converts 0 to 'A', 1 to 'B'... 25 to 'Z', 26 to 'AA' etc
  static colAsRef(colIndex) {
    let colRef = "";

    while (colIndex >= Util.ALPHABET_LENGTH) {
      colRef = Util.colSingleRef(colIndex % Util.ALPHABET_LENGTH) + colRef;

      colIndex = Math.trunc(colIndex / Util.ALPHABET_LENGTH) - 1;
    }

    return Util.colSingleRef(colIndex % Util.ALPHABET_LENGTH) + colRef;
  }

  static rowIndexFromRef(rowRef) {
    return Number(rowRef) - 1;
  }

  static rowAsRef(row) {
    return (row + 1).toString();
  }

  static asRef(row, col, absoluteRow = false, absoluteCol = false) {
    return (
      (absoluteCol ? "$" : "") +
      Util.colAsRef(col) +
      (absoluteRow ? "$" : "") +
      Util.rowAsRef(row)
    );
  }

  static rowColFromRef(ref) {
    const match = ref.toUpperCase().match(/^([$]?)([A-Z]+)([$]?)(\d+)$/i);
    const absoluteCol = match[1] === "$";
    const col = Util.colIndexFromRef(match[2]);
    const absoluteRow = match[3] === "$";
    const row = Util.rowIndexFromRef(match[4]);

    return { row, col, absoluteRow, absoluteCol };
  }

  static addRowsColsToRef(ref, rowsToAdd, colsToAdd) {
    const { row, col, absoluteRow, absoluteCol } = Util.rowColFromRef(ref);

    return Util.asRef(
      absoluteRow ? row : row + rowsToAdd,
      absoluteCol ? col : col + colsToAdd,
      absoluteRow,
      absoluteCol
    );
  }

  static refsDistance(refA, refB) {
    const { row: rowA, col: colA } = Util.rowColFromRef(refA);
    const { row: rowB, col: colB } = Util.rowColFromRef(refB);

    return [rowB - rowA, colB - colA];
  }

  static isFormula(value) {
    return typeof value === "string" && value.startsWith("=");
  }

  static extractFormulaContents(formula) {
    return formula.slice(1);
  }

  static findRefsInFormula({
    formula,
    removeAbsoluteMarkers = true,
    expandRanges = true
  }) {
    const updatedFormula = expandRanges ? Util.expandRanges(formula) : formula;

    return new Set(
      (updatedFormula.toUpperCase().match(/[$]?[A-Z]+[$]?\d+\b/gi) || []).map(
        ref =>
          removeAbsoluteMarkers
            ? ref.replace(/[$]?([A-Z]+)[$]?(\d+)\b/gi, "$1$2")
            : ref
      )
    );
  }

  static removeAbsoluteReferences(formula) {
    return formula.replace(/[$]?([A-Z]+)[$]?(\d+)\b/gi, "$1$2");
  }

  static expandRanges(formula) {
    return formula.replace(
      /[$]?([A-Z]+)[$]?(\d+):[$]?([A-Z]+)[$]?(\d+)\b/gi,
      range => JSON.stringify(Util.expandRange(range)).replace(/"/g, "")
    );
  }

  static replaceRefInFormula(
    evaluatedValue,
    ref,
    value,
    defaultNumericalValue = 0
  ) {
    let updatedValue;

    switch (typeof value) {
      case "string":
        // Is it actually an integer or floating point number represented as a string?
        if (value.match(/^-?\d+([.]\d*)?$/)) {
          updatedValue = Number(value);
        } else {
          updatedValue = value || defaultNumericalValue;
        }
        break;
      case "number":
        updatedValue = value;
        break;
      default:
        updatedValue = value || defaultNumericalValue;
    }

    return evaluatedValue.replace(
      new RegExp(`\\b${ref}\\b`, "gi"),
      typeof updatedValue === "string"
        ? updatedValue
        : updatedValue < 0
        ? `(${updatedValue})`
        : updatedValue
    );
  }

  static expandRange(range) {
    const rangeRefs = range.split(":");
    const rangeRefsRowCols = {
      topLeft: Util.rowColFromRef(rangeRefs[0]),
      bottomRight: Util.rowColFromRef(rangeRefs[1])
    };
    let rows = [];

    for (
      let row = rangeRefsRowCols.topLeft.row;
      row <= rangeRefsRowCols.bottomRight.row;
      row++
    ) {
      let cols = [];

      for (
        let col = rangeRefsRowCols.topLeft.col;
        col <= rangeRefsRowCols.bottomRight.col;
        col++
      ) {
        cols.push(Util.asRef(row, col));
      }

      rows.push(cols);
    }

    return rows;
  }
}

export default Util;
