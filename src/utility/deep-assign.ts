/**
 * 深いオブジェクトの割り当てを行う関数です。
 * @param target 割り当て先のオブジェクト
 * @param sources 割り当てるオブジェクトの可変引数
 * @returns 割り当て後のオブジェクト
 */
export function deepAssign(target: any, ...sources: any[]): any {
  sources.forEach((source) => {
    // キーごとにループ
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        // オブジェクトの場合、再帰的に割り当て
        if (source[key] && typeof source[key] === "object") {
          if (!target[key] || typeof target[key] !== "object") {
            target[key] = {};
          }
          deepAssign(target[key], source[key]);
        } else {
          // プリミティブ値の場合、直接割り当て
          target[key] = source[key];
        }
      }
    }
  });
  return target;
}
