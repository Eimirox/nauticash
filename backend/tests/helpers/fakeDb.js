// backend/tests/helpers/fakeDb.js
// Base MongoDB simulée en mémoire (sans dépendance) : implémente uniquement le
// sous-ensemble de l'API du driver utilisé par les routes (findOne, find().toArray(),
// insertOne, updateOne avec $set / $unset / $push / $pull / opérateur positionnel "$",
// filtres par égalité, chemins pointés, $in, $gt, $gte, $lt, $lte).

const mongoose = require("mongoose");

const { ObjectId } = mongoose.Types;

const isObjectId = (v) => v && typeof v === "object" && v._bsontype === "ObjectId";
const isPlainObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v) && !isObjectId(v) && !(v instanceof Date);

function clone(v) {
  if (isObjectId(v)) return new ObjectId(v.toHexString());
  if (v instanceof Date) return new Date(v.getTime());
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = clone(val);
    return out;
  }
  return v;
}

function comparable(v) {
  if (isObjectId(v)) return v.toHexString();
  if (v instanceof Date) return v.getTime();
  return v;
}

const eq = (a, b) => comparable(a) === comparable(b);

// Toutes les valeurs atteignables par un chemin pointé ("portfolio.ticker"),
// en traversant les tableaux comme le fait MongoDB.
function valuesAt(doc, path) {
  const [head, ...rest] = path.split(".");
  if (doc === null || doc === undefined) return [];
  if (Array.isArray(doc)) return doc.flatMap((d) => valuesAt(d, path));
  const value = doc[head];
  if (!rest.length) return [value];
  return valuesAt(value, rest.join("."));
}

function matchCondition(candidates, cond) {
  const flat = candidates.flatMap((c) => (Array.isArray(c) ? [c, ...c] : [c]));

  if (isPlainObject(cond) && Object.keys(cond).some((k) => k.startsWith("$"))) {
    return Object.entries(cond).every(([op, arg]) => {
      switch (op) {
        case "$in": return flat.some((c) => arg.some((a) => eq(c, a)));
        case "$gt": return flat.some((c) => c !== null && c !== undefined && comparable(c) > comparable(arg));
        case "$gte": return flat.some((c) => c !== null && c !== undefined && comparable(c) >= comparable(arg));
        case "$lt": return flat.some((c) => c !== null && c !== undefined && comparable(c) < comparable(arg));
        case "$lte": return flat.some((c) => c !== null && c !== undefined && comparable(c) <= comparable(arg));
        case "$exists": return arg ? flat.some((c) => c !== undefined) : flat.every((c) => c === undefined);
        default: throw new Error(`fakeDb : opérateur non géré ${op}`);
      }
    });
  }

  if (cond === null) return flat.length === 0 || flat.some((c) => c === null || c === undefined);
  return flat.some((c) => eq(c, cond));
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([path, cond]) => matchCondition(valuesAt(doc, path), cond));
}

// Objet partiel : { ticker: "AAPL" } correspond à l'élément { ticker: "AAPL", quantity: 2 }
const elementMatches = (el, cond) =>
  isPlainObject(cond) ? matches(el, cond) : eq(el, cond);

function setPath(doc, path, value, positionalIndex) {
  const parts = path.split(".");
  let target = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    let key = parts[i];
    if (key === "$") key = positionalIndex;
    if (target[key] === undefined || target[key] === null) target[key] = {};
    target = target[key];
  }
  const last = parts[parts.length - 1] === "$" ? positionalIndex : parts[parts.length - 1];
  target[last] = clone(value);
}

function unsetPath(doc, path) {
  const parts = path.split(".");
  let target = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target?.[parts[i]];
  }
  if (target) delete target[parts[parts.length - 1]];
}

// Index de l'élément de tableau désigné par "$" (premier élément qui correspond au filtre)
function positionalIndex(doc, filter) {
  for (const [path, cond] of Object.entries(filter)) {
    const [arrayField, ...rest] = path.split(".");
    if (!rest.length || !Array.isArray(doc[arrayField])) continue;
    const idx = doc[arrayField].findIndex((el) => matchCondition(valuesAt(el, rest.join(".")), cond));
    if (idx >= 0) return idx;
  }
  return undefined;
}

function applyUpdate(doc, update, filter) {
  const pos = positionalIndex(doc, filter);
  for (const [op, fields] of Object.entries(update)) {
    for (const [path, value] of Object.entries(fields)) {
      switch (op) {
        case "$set":
          if (path.includes(".$") && pos === undefined) throw new Error("fakeDb : opérateur positionnel sans correspondance");
          setPath(doc, path, value, pos);
          break;
        case "$unset":
          unsetPath(doc, path);
          break;
        case "$push": {
          const arr = valuesAt(doc, path)[0];
          if (arr === undefined) setPath(doc, path, [value]);
          else arr.push(clone(value));
          break;
        }
        case "$pull": {
          const arr = valuesAt(doc, path)[0];
          if (Array.isArray(arr)) setPath(doc, path, arr.filter((el) => !elementMatches(el, value)));
          break;
        }
        default:
          throw new Error(`fakeDb : opérateur de mise à jour non géré ${op}`);
      }
    }
  }
}

const snapshot = (doc) => JSON.stringify(doc);

class FakeCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
  }

  async insertOne(doc) {
    const copy = clone(doc);
    if (!copy._id) copy._id = new ObjectId();
    this.docs.push(copy);
    return { acknowledged: true, insertedId: copy._id };
  }

  async findOne(filter = {}) {
    const doc = this.docs.find((d) => matches(d, filter));
    return doc ? clone(doc) : null;
  }

  find(filter = {}) {
    const found = this.docs.filter((d) => matches(d, filter)).map(clone);
    return { toArray: async () => found };
  }

  async updateOne(filter, update, { upsert = false } = {}) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) {
      if (!upsert) return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      const base = {};
      for (const [k, v] of Object.entries(filter)) {
        if (!k.includes(".") && !(isPlainObject(v) && Object.keys(v).some((x) => x.startsWith("$")))) base[k] = v;
      }
      const created = { _id: new ObjectId(), ...clone(base) };
      applyUpdate(created, update, {});
      this.docs.push(created);
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: created._id };
    }
    const before = snapshot(doc);
    applyUpdate(doc, update, filter);
    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: snapshot(doc) === before ? 0 : 1,
      upsertedCount: 0,
    };
  }

  // Remplace (ou ajoute) le document ayant le même _id : utilisé par document.save()
  async replaceById(doc) {
    const copy = clone(doc);
    const idx = this.docs.findIndex((d) => eq(d._id, copy._id));
    if (idx >= 0) this.docs[idx] = copy;
    else this.docs.push(copy);
  }

  async deleteMany(filter = {}) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return { acknowledged: true, deletedCount: before - this.docs.length };
  }

  async deleteOne(filter = {}) {
    const idx = this.docs.findIndex((d) => matches(d, filter));
    if (idx >= 0) this.docs.splice(idx, 1);
    return { acknowledged: true, deletedCount: idx >= 0 ? 1 : 0 };
  }
}

class FakeDb {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollection(name));
    return this.collections.get(name);
  }

  reset() {
    this.collections.clear();
  }
}

module.exports = { FakeDb, FakeCollection, matches, clone };
