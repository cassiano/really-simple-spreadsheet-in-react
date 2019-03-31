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

  static asRef(row, col) {
    return Util.colAsRef(col) + Util.rowAsRef(row);
  }

  static rowColFromRef(ref) {
    const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i);
    const row = Util.rowIndexFromRef(match[2]);
    const col = Util.colIndexFromRef(match[1]);

    return [row, col];
  }

  static isFormula(value) {
    return typeof value === "string" && value.startsWith("=");
  }

  static extractFormulaContents(formula) {
    return formula.slice(1);
  }

  static findRefsInFormula(formula) {
    return new Set(
      (formula.toUpperCase().match(/\$?[A-Z]+\$?\d+\b/gi) || []).map(ref =>
        ref.replace(/\$?([A-Z]+)\$?(\d+)\b/gi, "$1$2")
      )
    );
  }

  static removeAbsoluteReferences(formula) {
    return formula.replace(/\$?([A-Z]+)\$?(\d+)\b/gi, "$1$2");
  }

  static replaceRefInFormula(evaluatedValue, ref, value, default_value = 0) {
    return (evaluatedValue = evaluatedValue.replace(
      new RegExp(`\\b${ref}\\b`, "gi"),
      `(${value || default_value})`
    ));
  }
}

export default Util;
