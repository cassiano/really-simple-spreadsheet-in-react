Set.prototype.concat = function(anotherSetOrArray) {
  anotherSetOrArray.forEach(item => this.add(item));

  return this;
};

Set.prototype.diff = function(anotherSet) {
  return new Set([...this].filter(item => !anotherSet.has(item)));
};

Set.prototype.intersection = function(anotherSet) {
  return new Set([...this].filter(item => anotherSet.has(item)));
};
