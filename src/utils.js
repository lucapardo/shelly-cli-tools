import { writeFileSync } from "fs";

function jsonToFile(jsonDocument, fileName) {
  const flattenJSON = (json) => {
    const _flatArray = Object.entries(json).reduce(
      (arrayResult, [key, value]) => {
        arrayResult.push(typeof value == 'object' ? flattenJSON(value) : value);
        return arrayResult;
      },
      []
    );
    return _flatArray.join(',');
  };
  writeFileSync(fileName, flattenJSON(jsonDocument) + '\n', {
    flag: 'a+',
  });
}

function mapToFile(map, fileName, filterFn) {
  const flattenMap = (map_) =>
    Array.from(map_.entries())
      .filter(([key, value]) => !filterFn || filterFn(key, value))
      .map(([key, value]) => value)
      .join(',');
  writeFileSync(fileName, flattenMap(map) + '\n', { flag: 'a+' });
}

export { jsonToFile, mapToFile };
