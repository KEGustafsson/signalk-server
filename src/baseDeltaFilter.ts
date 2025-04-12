/**
 * Interface representing a single update value with a path and value
 */
export interface UpdateValue {
  path: string;
  value: any;
}

/**
 * Interface representing an update operation which may contain multiple values
 * and additional arbitrary properties
 */
export interface Update {
  values?: UpdateValue[];
  [key: string]: any;
}

/**
 * Filters out specified paths from an update object or array
 * @param update - The update object or array to filter
 * @param pathToRemove - Array of UpdateValue objects specifying paths/values to remove
 * @returns Filtered update object or array
 */
export function filterUpdates(update: Update | any[], pathToRemove: UpdateValue[]): Update | any[] {
  if (Array.isArray(update)) {
    // If input is an array, recursively filter each item
    return update.map(item => filterUpdates(item, pathToRemove));
  }

  if (update.values && Array.isArray(update.values)) {
    // Consolidate root paths (empty string paths) first
    const consolidated = consolidateRootPaths(update.values);
    
    // Filter out values that match any of the paths to remove
    const filteredValues = consolidated.filter(updateValue => {
      return !pathToRemove.some(removeItem => {
        if (updateValue.path === '' && removeItem.path === '') {
          // Special case for root paths - check property matching
          return hasMatchingProperties(updateValue.value, removeItem.value);
        }
        return isMatchingPathValue(updateValue, removeItem);
      });
    });

    // Reconstruct values to remove nested properties from remaining objects
    const reconstructedValues = reconstructValues(filteredValues, pathToRemove);
    
    return {
      ...update,
      values: reconstructedValues
    };
  }

  return update;
}

/**
 * Consolidates multiple root path updates (empty string paths) into a single update
 * @param values - Array of UpdateValue objects
 * @returns Consolidated array of UpdateValue objects
 */
function consolidateRootPaths(values: UpdateValue[]): UpdateValue[] {
  const rootValues = values.filter(v => v.path === '');
  const otherValues = values.filter(v => v.path !== '');
  
  if (rootValues.length <= 1) return values;
  
  // Merge all root values into a single object
  const mergedRootValue = rootValues.reduce((acc, curr) => {
    return { path: '', value: deepMerge(acc.value, curr.value) };
  }, { path: '', value: {} });
  
  return [mergedRootValue, ...otherValues];
}

/**
 * Deep merges two objects
 * @param target - Target object to merge into
 * @param source - Source object to merge from
 * @returns Merged object
 */
function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      // Recursively merge objects
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      // Assign primitive values or arrays directly
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Checks if two UpdateValue objects match based on their paths and values
 * @param updateValue - UpdateValue to check
 * @param removeItem - UpdateValue to compare against
 * @returns True if paths/values match, false otherwise
 */
function isMatchingPathValue(updateValue: UpdateValue, removeItem: UpdateValue): boolean {
  if (updateValue.path === removeItem.path) {
    return true;
  }
  
  // Handle cases where one path is root ('') and the other is nested
  if (updateValue.path === '') {
    const nestedPath = getNestedValue(updateValue.value, removeItem.path);
    return nestedPath !== undefined;
  }
  
  if (removeItem.path === '') {
    const nestedPath = getNestedValue(removeItem.value, updateValue.path);
    return nestedPath !== undefined;
  }
  
  return false;
}

/**
 * Checks if an object contains all properties matching a pattern object
 * @param obj - Object to check
 * @param pattern - Pattern object to match against
 * @returns True if all pattern properties match, false otherwise
 */
function hasMatchingProperties(obj: any, pattern: any): boolean {
  if (typeof pattern !== 'object' || pattern === null) {
    return isValueMatch(obj, pattern);
  }
  
  return Object.keys(pattern).every(key => {
    if (!(key in obj)) return false;
    return hasMatchingProperties(obj[key], pattern[key]);
  });
}

/**
 * Compares two values for equality with case-insensitive string comparison
 * @param value - First value to compare
 * @param pattern - Second value to compare
 * @returns True if values match, false otherwise
 */
function isValueMatch(value: any, pattern: any): boolean {
  if (typeof value === 'string' && typeof pattern === 'string') {
    return value.toLowerCase() === pattern.toLowerCase();
  }
  return value === pattern;
}

/**
 * Gets a nested value from an object using dot notation path
 * @param obj - Object to traverse
 * @param path - Dot notation path (e.g., 'a.b.c')
 * @returns The value at the specified path or undefined if not found
 */
function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Reconstructs values by removing nested properties that match removal patterns
 * @param values - Array of UpdateValue objects to process
 * @param pathToRemove - Array of UpdateValue objects specifying removal patterns
 * @returns Array of reconstructed UpdateValue objects
 */
function reconstructValues(values: UpdateValue[], pathToRemove: UpdateValue[]): UpdateValue[] {
  return values.map(updateValue => {
    if (typeof updateValue.value !== 'object' || updateValue.value === null) {
      return updateValue;
    }
    
    // Find removal patterns that match this updateValue's path
    const removePatterns = pathToRemove.filter(removeItem => {
      if (removeItem.path !== updateValue.path) return false;
      return typeof removeItem.value === 'object' && removeItem.value !== null;
    });
    
    if (removePatterns.length === 0) return updateValue;
    
    // Deep clone and remove matched properties
    const newValue = deepCloneAndRemove(updateValue.value, removePatterns);
    return { ...updateValue, value: newValue };
  });
}

/**
 * Deep clones an object while removing properties that match removal patterns
 * @param obj - Object to clone and modify
 * @param removePatterns - Array of UpdateValue objects specifying removal patterns
 * @returns New object with specified properties removed
 */
function deepCloneAndRemove(obj: any, removePatterns: UpdateValue[]): any {
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const pattern of removePatterns) {
    for (const key in pattern.value) {
      if (key in result) {
        if (typeof pattern.value[key] === 'object' && pattern.value[key] !== null) {
          // Recursively process nested objects
          result[key] = deepCloneAndRemove(result[key], [{
            path: pattern.path,
            value: pattern.value[key]
          }]);
          // Remove empty objects
          if (Object.keys(result[key]).length === 0) {
            delete result[key];
          }
        } else if (isValueMatch(result[key], pattern.value[key])) {
          // Remove matching primitive values
          delete result[key];
        }
      }
    }
  }
  
  return result;
}

//------------------ Extract path and value pairs from baseDelta------------------ 
// This function is used to extract path and value pairs from the baseDelta object
// and return them in a flattened array. Used for filtering of SK data streams.

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