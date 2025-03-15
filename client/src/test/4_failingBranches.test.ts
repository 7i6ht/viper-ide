import assert from 'assert';
import TestHelper, { SETUP_TIMEOUT, SILICON } from './TestHelper';
import * as fs from 'fs';
import * as path from 'path';

suite('ViperIDE Failing Branches Tests', () => {

    const testDir = 'failingBranches';

    suiteSetup(async function() {
        this.timeout(SETUP_TIMEOUT);
        await TestHelper.setup();
    });

    suiteTeardown(async function() {
        await TestHelper.teardown();
    });

    async function testFile(file: string, expectedFile: string, expectedBeams : object) {
        await TestHelper.openFile(`${testDir}/${file}`);
        await TestHelper.waitForVerification(file);
        const actualDiagnostics = TestHelper.getUpdatedDiagnostics();
        const actualTree = (actualDiagnostics.length > 0)
                                ? actualDiagnostics.at(-1).message
                                : "Verification successful.";
        const actualDecOpts = TestHelper.getDecorationOptions();
        const actualBeams = actualDecOpts.length > 0 ? actualDecOpts[0]["range"] : [];
        assert.deepEqual(actualBeams, expectedBeams, "Beam ranges not equal");
        const expectedFileFile = TestHelper.getTestDataPath(`${testDir}/${expectedFile}`);
        const expectedTree = fs.readFileSync(expectedFileFile, 'utf-8');
        assert(actualTree.includes(expectedTree),
            "Unexpected verification result."
              +`\nActual string\n${actualTree}`
              +`did not include\n${expectedTree}`);
    }

    test("1. FirstPathFails", async function() {
        this.timeout(35000);
        TestHelper.resetDecorationOptions();
        TestHelper.resetDiagnostics();
        await testFile("firstPathFails.vpr",
            "firstPathFails_expected",
            {c:{"c":5,"e":0},e:{"c":11,"e":0}}
        );
    });

    test("2. LastPathFails", async function() {
        this.timeout(35000);
        TestHelper.resetDecorationOptions();
        TestHelper.resetDiagnostics();
        await testFile("lastPathFails.vpr",
            "lastPathFails_expected",
            {c:{"c":11,"e":0},e:{"c":19,"e":0}}
        );
    });

    test("3. OnlyIf", async function() {
        this.timeout(35000);
        TestHelper.resetDecorationOptions();
        TestHelper.resetDiagnostics();
        await testFile("onlyIf.vpr",
            "onlyIf_expected",
            {c:{"c":6,"e":0},e:{"c":10,"e":0}}
        );
    });

    test("4. While", async function() {
        this.timeout(35000);
        TestHelper.resetDecorationOptions();
        TestHelper.resetDiagnostics();
        await testFile("while.vpr",
            "while_expected",
            {c:{"c":12,"e":0},e:{"c":13,"e":0}}
        );
    });

    test("5. AllPathsCorrect", async function() {
        this.timeout(35000);
        TestHelper.resetDecorationOptions();
        TestHelper.resetDiagnostics();
        await testFile("allPathsCorrect.vpr",
            "allPathsCorrect_expected",
            []
        );
    });

    test("6. NoBranches", async function() {
        this.timeout(35000);
        TestHelper.resetDecorationOptions();
        TestHelper.resetDiagnostics();
        await testFile("noBranches.vpr",
            "noBranches_expected",
            []
        );
    });
});
