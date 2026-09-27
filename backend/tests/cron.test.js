// Tests : planification de l'actualisation des prix (node-cron v4)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const cron = require("node-cron");
const config = require("../config/providers");
const updater = require("../jobs/updatePrices");

test("la planification par défaut est une expression cron valide", () => {
  assert.ok(cron.validate(config.cron.updatePrices.schedule));
});

test("démarre et s'arrête proprement quand le cron est activé", () => {
  const original = { ...config.cron.updatePrices };
  const log = console.log;
  console.log = () => {};
  try {
    config.cron.updatePrices.enabled = true;
    const task = updater.start();
    assert.ok(task, "tâche planifiée créée");
    assert.equal(typeof task.stop, "function");
    updater.stop();
    assert.equal(updater.task, null);
  } finally {
    Object.assign(config.cron.updatePrices, original);
    console.log = log;
  }
});

test("une planification invalide désactive l'actualisation sans planter", () => {
  const original = { ...config.cron.updatePrices };
  const [log, err] = [console.log, console.error];
  console.log = console.error = () => {};
  try {
    Object.assign(config.cron.updatePrices, { enabled: true, schedule: "pas une expression" });
    assert.equal(updater.start(), null);
  } finally {
    Object.assign(config.cron.updatePrices, original);
    console.log = log;
    console.error = err;
  }
});
