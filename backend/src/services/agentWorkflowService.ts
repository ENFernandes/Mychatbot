import { Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";

export type WorkflowInput = { 
  input_as_text: string;
  apiKey: string;
  workflowId: string;
  model: string;
  instructions: string;
};

export type WorkflowResult = {
  output_text: string;
};

// Main workflow entrypoint
export const runWorkflow = async (workflow: WorkflowInput): Promise<WorkflowResult> => {
  // Set the API key for the OpenAI client
  process.env.OPENAI_API_KEY = workflow.apiKey;
  
  // Create agent with dynamic configuration
  const agent = new Agent({
    name: "DynamicAgent",
    instructions: workflow.instructions,
    model: workflow.model as any,
    modelSettings: {
      store: true
    }
  });

  return await withTrace("AgentPrompt", async () => {
    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] }
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: workflow.workflowId
      }
    });

    const resultTemp = await runner.run(
      agent,
      [
        ...conversationHistory
      ]
    );

    conversationHistory.push(...resultTemp.newItems.map((item) => item.rawItem));

    if (!resultTemp.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    const result: WorkflowResult = {
      output_text: resultTemp.finalOutput ?? ""
    };

    return result;
  });
};
