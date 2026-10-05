// https://github.com/alyssaq/stats-analysis

/* Mini statistics library to calculate/perform:
 * - Mean
 * - Median
 * - Standard Deviation
 * - Mean Absolute Deviation (MAD)
 * - Outlier detection (Iglewicz and Hoaglin method)
 * - Remove outliers from an array of numbers
 */

const outlierMethod = {
  MAD: "MAD",
  medianDiff: "medianDiff",
};

function mean(arr) {
  return arr.reduce((prev, curr) => prev + curr) / arr.length;
}

function variance(arr) {
  const dataMean = mean(arr);

  return mean(arr.map(val => Math.pow(val - dataMean, 2)));
}

function stdev(arr) {
  return Math.sqrt(variance(arr));
}

function median(arr) {
  const half = Math.floor(arr.length / 2);
  arr = arr.slice(0).sort(numSorter);

  if (arr.length % 2) {
    // Odd length, true middle element
    return arr[half];
  }
  // Even length, average middle two elements
  return (arr[half - 1] + arr[half]) / 2.0;
}

function medianAbsoluteDeviation(arr, dataMedian) {
  dataMedian = dataMedian || median(arr);
  const absoluteDeviation = arr.map(val => Math.abs(val - dataMedian));

  return median(absoluteDeviation);
}

function numSorter(a, b) {
  return a - b;
}

// Iglewicz and Hoaglin method
//  values with a Z-score > 3.5 are considered potential outliers
function isMADoutlier(val, threshold, dataMedian, dataMAD) {
  return Math.abs(0.6745 * (val - dataMedian) / dataMAD) > threshold;
}

function indexOfMADoutliers(arr, threshold) {
  threshold = threshold || 3.5; // Default recommended threshold
  const dataMedian = median(arr);
  const dataMAD = medianAbsoluteDeviation(arr, dataMedian);

  return arr.reduce((res, val, i) => {
    if (isMADoutlier(val, threshold, dataMedian, dataMAD)) {
      res.push(i);
    }
    return res;
  }, []);
}

function filterMADoutliers(arr, threshold) {
  threshold = threshold || 3.5; // Default recommended threshold
  const dataMedian = median(arr);
  const dataMAD = medianAbsoluteDeviation(arr, dataMedian);

  return arr.filter(val => !isMADoutlier(val, threshold, dataMedian, dataMAD));
}

// Median filtering from difference between values
function differences(arr) {
  return arr.map((d, i) => Math.round(Math.abs(d - (arr[i - 1] || d[0]))) + 1);
}

function isMedianDiffOutlier(threshold, difference, medianDiff) {
  return difference / medianDiff > threshold;
}

function indexOfMedianDiffOutliers(arr, threshold) {
  threshold = threshold || 3; // Default threshold of 3 std
  const differencesArr = differences(arr);
  const medianDiff = median(differencesArr);

  return arr.reduce((res, val, i) => {
    if (isMedianDiffOutlier(threshold, differencesArr[i], medianDiff)) {
      res.push(i);
    }
    return res;
  }, []);
}

function filterMedianDiffOutliers(arr, threshold) {
  threshold = threshold || 3; // Default threshold of 3 std
  const differencesArr = differences(arr);
  const medianDiff = median(differencesArr);

  return arr.filter(
    (_, i) => !isMedianDiffOutlier(threshold, differencesArr[i], medianDiff)
  );
}

function filterOutliers(arr, method, threshold) {
  switch (method) {
    case outlierMethod.MAD:
      return filterMADoutliers(arr, threshold);
    default:
      return filterMedianDiffOutliers(arr, threshold);
  }
}

function indexOfOutliers(arr, method, threshold) {
  switch (method) {
    case outlierMethod.MAD:
      return indexOfMADoutliers(arr, threshold);
    default:
      return indexOfMedianDiffOutliers(arr, threshold);
  }
}

export default {
  stdev,
  mean,
  median,
  medianAbsoluteDeviation,
  mad: medianAbsoluteDeviation,
  numSorter,
  outlierMethod,
  filterOutliers,
  indexOfOutliers,
  filterMADoutliers,
  indexOfMADoutliers,
  filterMedianDiffOutliers,
  indexOfMedianDiffOutliers,
};
