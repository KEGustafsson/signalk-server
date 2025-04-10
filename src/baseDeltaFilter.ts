export interface UpdateValue {
  path: string;
  value: any;
}

export interface Update {
  values?: UpdateValue[];
  [key: string]: any;
}

export function filterUpdates(update: Update | any[], pathToRemove: UpdateValue[]): Update | any[] {
  if (Array.isArray(update)) {
    return update.map(item => filterUpdates(item, pathToRemove));
  }

  if (update.values && Array.isArray(update.values)) {
    const consolidated = consolidateRootPaths(update.values);
    const filteredValues = consolidated.filter(updateValue => {
      return !pathToRemove.some(removeItem => {
        if (updateValue.path === '' && removeItem.path === '') {
          return hasMatchingProperties(updateValue.value, removeItem.value);
        }
        return isMatchingPathValue(updateValue, removeItem);
      });
    });

    const reconstructedValues = reconstructValues(filteredValues, pathToRemove);
    
    return {
      ...update,
      values: reconstructedValues
    };
  }

  return update;
}

function consolidateRootPaths(values: UpdateValue[]): UpdateValue[] {
  const rootValues = values.filter(v => v.path === '');
  const otherValues = values.filter(v => v.path !== '');
  
  if (rootValues.length <= 1) return values;
  
  const mergedRootValue = rootValues.reduce((acc, curr) => {
    return { path: '', value: deepMerge(acc.value, curr.value) };
  }, { path: '', value: {} });
  
  return [mergedRootValue, ...otherValues];
}

function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function isNumericalPath(path: string): boolean {
  return /^\d+$/.test(path);
}

function isMatchingPathValue(updateValue: UpdateValue, removeItem: UpdateValue): boolean {
  if (updateValue.path === removeItem.path) {
    if (typeof updateValue.value === 'number' || typeof removeItem.value === 'number') {
      return true;
    }
    return hasMatchingProperties(updateValue.value, removeItem.value);
  }
  
  if (updateValue.path === '') {
    const nestedValue = getNestedValue(updateValue.value, removeItem.path);
    return nestedValue !== undefined && hasMatchingProperties(nestedValue, removeItem.value);
  }
  
  if (removeItem.path === '') {
    const nestedValue = getNestedValue(removeItem.value, updateValue.path);
    return nestedValue !== undefined && hasMatchingProperties(updateValue.value, nestedValue);
  }
  
  return false;
}

function hasMatchingProperties(obj: any, pattern: any): boolean {
  if (typeof pattern !== 'object' || pattern === null) {
    return isValueMatch(obj, pattern);
  }
  
  return Object.keys(pattern).every(key => {
    if (!(key in obj)) return false;
    return hasMatchingProperties(obj[key], pattern[key]);
  });
}

function isValueMatch(value: any, pattern: any): boolean {
  if (typeof value === 'string' && typeof pattern === 'string') {
    return value.toLowerCase() === pattern.toLowerCase();
  }
  return value === pattern;
}

function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function reconstructValues(values: UpdateValue[], pathToRemove: UpdateValue[]): UpdateValue[] {
  return values.map(updateValue => {
    if (typeof updateValue.value !== 'object' || updateValue.value === null) {
      return updateValue;
    }
    
    const removePatterns = pathToRemove.filter(removeItem => {
      if (removeItem.path !== updateValue.path) return false;
      return typeof removeItem.value === 'object' && removeItem.value !== null;
    });
    
    if (removePatterns.length === 0) return updateValue;
    
    const newValue = deepCloneAndRemove(updateValue.value, removePatterns);
    return { ...updateValue, value: newValue };
  });
}

function deepCloneAndRemove(obj: any, removePatterns: UpdateValue[]): any {
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const pattern of removePatterns) {
    for (const key in pattern.value) {
      if (key in result) {
        if (typeof pattern.value[key] === 'object' && pattern.value[key] !== null) {
          result[key] = deepCloneAndRemove(result[key], [{
            path: pattern.path,
            value: pattern.value[key]
          }]);
          if (Object.keys(result[key]).length === 0) {
            delete result[key];
          }
        } else if (isValueMatch(result[key], pattern.value[key])) {
          delete result[key];
        }
      }
    }
  }
  
  return result;
}

interface PathValuePair {
  path: string;
  value: any; // Consider using a more specific type if possible
}

interface InputData {
  values: Array<{
    path: string;
    value: any; // Consider using a more specific type if possible
  }>;
}

export function extractPathValuePairs(data: InputData): PathValuePair[] {
  const result: PathValuePair[] = [];
  
  data.values.forEach(item => {
    if (item.path === "") {
      // Handle root level properties
      if (typeof item.value === 'object' && item.value !== null) {
        Object.entries(item.value).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([subKey, subValue]) => {
              result.push({
                path: key,
                value: { [subKey]: subValue }
              });
            });
          } else {
            result.push({
              path: "",
              value: { [key]: value }
            });
          }
        });
      }
    } else {
      // Handle nested paths
      if (typeof item.value === 'object' && item.value !== null) {
        Object.entries(item.value).forEach(([key, value]) => {
          result.push({
            path: item.path,
            value: { [key]: value }
          });
        });
      } else {
        result.push({
          path: item.path,
          value: item.value
        });
      }
    }
  });
  
  return result;
}

// Optionally export the interfaces if they need to be used elsewhere
export type { PathValuePair, InputData };