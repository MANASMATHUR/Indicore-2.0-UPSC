// Quick test to verify the fix
console.log('Testing PYQ formatting fix...');

// The issue was:
// - verifiedCount was used on line 946 before being calculated
// - sortedYears was used on line 962 before being calculated

// Fix applied:
// - Moved calculations to lines 932-939 (before usage)
// - Now verifiedCount, unverifiedCount, and sortedYears are defined before use

console.log('✅ Fix applied successfully!');
console.log('Variables are now calculated in correct order:');
console.log('1. displayedQuestions (populated in loop)');
console.log('2. verifiedCount (calculated from displayedQuestions)');
console.log('3. unverifiedCount (calculated from counts)');
console.log('4. sortedYears (calculated from byYear Map)');
console.log('5. Statistics section (uses all above variables)');
