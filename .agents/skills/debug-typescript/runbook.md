# TypeScript Error Debugging Runbook

## Step 1: Read the Full Error

TypeScript errors often have nested "the types of X are not compatible because
the types of Y are not compatible because...". Read to the END — the root cause
is usually in the last line.

## Step 2: Identify the Pattern

| Error Pattern | Jump to |
|---|---|
| "Type X is not assignable to type Y" | Section A |
| "Property X does not exist on type Y" | Section B |
| "could be instantiated with a different subtype" | Section C |
| "Type X cannot be used as an index type" | Section D |
| "implicitly has an 'any' type" | Section E |
| "circularly references itself" | Section F |
| Errors after API type regeneration | Section G |

---

## Section A: Not Assignable

**Common causes:**
1. **Missing optional field:** type says required, value might be undefined
2. **Enum mismatch:** string literal vs enum value
3. **Stale types:** API types were regenerated and fields changed

**Investigation:**
1. Hover over both sides — what is the actual type vs expected?
2. Trace back to where the value originates
3. Check if the type was recently regenerated

**Fixes:**
- Add optional chaining if the field might not exist
- Use type assertion ONLY as last resort (prefer narrowing)
- If types drifted after regeneration, update the consuming code

---

## Section B: Property Does Not Exist

**Common causes:**
1. Object is typed too broadly (`any`, `object`, `{}`)
2. Missing type narrowing for union types
3. Accessing a nested property without optional chaining

**Fixes:**
- Narrow the type: `if ("prop" in obj)` or `if (obj.kind === "specific")`
- Add optional chaining: `obj?.nested?.prop`
- Improve the type annotation to be more specific

---

## Section C: Different Subtype (Generics)

**Cause:** Generic constraint is too loose. The function claims to work with
any `T extends Base`, but the implementation assumes a specific subtype.

**Fix:** Tighten the generic constraint, or remove the generic and use the
concrete type.

---

## Section D: Cannot Be Used as Index Type

**Cause:** Using a non-string/number/symbol as an object key.

**Fix:**
- Use `keyof typeof obj` for known keys
- Use `Record<string, ValueType>` for dynamic keys
- Add a type assertion: `obj[key as keyof ObjType]`

---

## Section E: Implicit Any

**Cause:** TypeScript can't infer the type.

**Fix:** Add an explicit type annotation. Common spots:
- Function parameters: `(event: React.ChangeEvent<HTMLInputElement>)`
- Callback params: `.map((item: ItemType) => ...)`
- Destructured props: `({ name, age }: Props)`

---

## Section F: Circular Reference

**Cause:** Two types reference each other directly.

**Fix:** Break the cycle with:
- A shared base type
- `type` alias instead of `interface` (can handle recursion differently)
- Lazy reference: `type A = { b: () => B }` instead of `type A = { b: B }`

---

## Section G: Errors After API Type Regeneration

**Investigation:**
1. Run `git diff` on the generated type file
2. Identify what changed: renamed fields, removed types, changed nullability
3. Search the codebase for usages of changed types

**Fix:**
- Update all usages to match new types
- If a field was renamed: find & replace across the codebase
- If a type was removed: find the replacement in the new types
- Run build to verify all errors are resolved
