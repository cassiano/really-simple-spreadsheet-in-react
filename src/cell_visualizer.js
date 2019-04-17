import React from "react";
import PropTypes from "prop-types";
import Cell from "./cell";
import $ from "jQuery";

class CellVisualizer extends React.Component {
  handleKeyPress = event => {
    const pressedKey = event.which || event.keyCode;
    const cellInputs = $("#spreadsheet .cell");
    const currentCellIndex = cellInputs.index(event.target);
    let nextCellIndex;
    const target = event.target;

    // console.log(pressedKey);

    switch (pressedKey) {
      case 13: // Enter
        nextCellIndex =
          (currentCellIndex + this.props.cols) % cellInputs.length;
        break;
      case 37: // Left
        if (target.value === "") {
          nextCellIndex =
            (currentCellIndex - 1 + cellInputs.length) % cellInputs.length;
        }
        break;
      case 38: // Up
        if (currentCellIndex === 0) {
          // 1st cell?
          nextCellIndex = cellInputs.length - 1; // Jump to last.
        } else if (Math.trunc(currentCellIndex / this.props.cols) === 0) {
          // 1st row?
          nextCellIndex =
            (currentCellIndex - (this.props.cols + 1) + cellInputs.length) %
            cellInputs.length;
        } else {
          nextCellIndex =
            (currentCellIndex - this.props.cols + cellInputs.length) %
            cellInputs.length;
        }
        break;
      case 39: // Right
        if (target.value === "") {
          nextCellIndex = (currentCellIndex + 1) % cellInputs.length;
        }
        break;
      case 40: // Down
        if (currentCellIndex === cellInputs.length - 1) {
          // Last cell?
          nextCellIndex = 0; // Jump to 1st.
        } else if (
          Math.trunc(currentCellIndex / this.props.cols) ===
          this.props.rows - 1
        ) {
          // Last row?
          nextCellIndex =
            (currentCellIndex + (this.props.cols + 1)) % cellInputs.length;
        } else {
          nextCellIndex =
            (currentCellIndex + this.props.cols) % cellInputs.length;
        }
        break;
      case 27: // Esc
        target.value = this.props.cell.value; // Restore previous value.
        setTimeout(() => target.select(), 0);
        break;
      default:
        break;
    }

    if (nextCellIndex !== undefined) {
      cellInputs[nextCellIndex].focus();
    }
  };

  render() {
    const cell = this.props.cell;

    return (
      <div
        style={{
          backgroundColor: cell.recalculated ? "yellow" : "white",
          padding: 5
        }}
      >
        <input
          type="text"
          className="cell"
          size={this.props.inputSize}
          autoComplete="off"
          defaultValue={cell.value}
          onBlur={event => this.props.onBlur(event, cell.value)}
          onFocus={event => {
            const target = event.target;
            setTimeout(() => target.select(), 0);
          }}
          onKeyDown={this.handleKeyPress}
          name="value"
          ref="value"
          tabIndex={this.props.index}
          style={{
            borderColor: cell.touched ? "red" : "lightGray",
            borderWidth: cell.touched ? 3 : 1,
            display: this.props.editMode ? "block" : "none"
          }}
        />
        &nbsp;
        <span>{cell.calculatedValue}</span>
      </div>
    );
  }
}

///////////////
// PropTypes //
///////////////

CellVisualizer.propTypes = {
  cell: PropTypes.instanceOf(Cell),
  onBlur: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired
};

export default CellVisualizer;
