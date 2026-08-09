

async function executeOSINTDualRuntime(project){

    const module =
    await import(
    "../src/utils/osintDualExecutionEngine.ts"
    );


    const result =
    await module.runOSINTDualExecution(project);


    return result;

}


module.exports = {
    executeOSINTDualRuntime
};

