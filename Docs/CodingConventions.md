# Coding conventions

Short on purpose. Change it when the team disagrees with it.

## Assemblies

| Assembly | Folder | May reference | Rule |
|---|---|---|---|
| `MiniMart.Simulation` | `Scripts/Simulation` | nothing (no UnityEngine) | Game rules: stock, money, goals, levels. Pure C#, deterministic, unit tested. The future host runs these authoritatively. |
| `MiniMart.Runtime` | `Scripts/` (everything else) | Simulation, Input System | MonoBehaviours, ScriptableObjects, presentation. Calls Simulation to change state; never re-implements a rule. |
| `MiniMart.Editor` | `Scripts/Editor` | Simulation, Runtime | Importers, scene builders, inspectors. |
| `MiniMart.Tests.EditMode` / `.PlayMode` | `Tests/` | all of the above | |

The test for "where does this code go": if it decides whether money, stock or progression changes,
it goes in Simulation. If it only shows or animates something, it goes in Runtime.

## Style

- C# 9 (Unity 6). One public type per file; MonoBehaviour and ScriptableObject files must be named after the class.
- Namespaces follow folders: `MiniMart.Simulation.Inventory`, `MiniMart.Interaction`, `MiniMart.World`, ...
- `PascalCase` types and members, `camelCase` private fields and locals, no `m_` or `_` prefixes.
- Serialized fields are `[SerializeField] private`; expose read-only properties.
- Money is whole rupees in `int`. Never `float` for money.
- Units are metres and seconds. The prototype's tile values (1 tile = 2 m) are converted at the boundary.
- Player-facing strings live next to the rule that produces them for now; move to a localisation table in Phase 4.
- No `FindObjectOfType` in gameplay code. Pass references, or use a scene-level registry.
- Don't hand-edit generated assets (`Scenes/*` from the scene builder, `ScriptableObjects/*` from the importer) and then regenerate: once you edit one by hand, stop regenerating it.

## Tests

- Every rule in Simulation gets an EditMode test. Name tests as sentences: `FullShelfRefusesAndChangesNothing`.
- Play-mode tests build their own objects in code (see `CarryAndStockTests`) rather than loading scenes.
- Re-run only failing tests while fixing; run the full suite before merging.

## Git

- Git LFS for binaries (see `.gitattributes`). Run `git lfs install` once per machine.
- Commit `.meta` files with their assets. Never commit `Library/`.
- Enable *Project Settings ▸ Editor ▸ Asset Serialization: Force Text* and *Version Control: Visible Meta Files* (Unity 6 defaults).
