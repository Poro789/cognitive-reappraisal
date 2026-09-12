export const STORAGE_KEY = "cognitive-reappraisal-entries";
export const WIZARD_KEY = "cognitive-reappraisal-wizard-draft";

// The 8 specific cognitive distortion types (Beck / Burns).
// "以上都不像" and "跳过" are handled as separate actions, not tags.
export const DISTORTIONS = [
    "灾难化", "非黑即白", "以偏概全", "读心术",
    "贴标签", "应该式思维", "个人化", "情绪化推理"
  ];

  // The "none of the above" marker — a distinct, meaningful negative signal
// (the user judged it's not a common distortion), exported to the reviewer.
export const NONE_OF_ABOVE = "以上都不像";

// Explanations for each distortion (based on Beck / Burns CBT literature)
export const DISTORTION_INFO = {
    "灾难化": {
      desc: "直接跳到最坏的可能结果，并把它当成必然会发生的事。",
      example: "这次汇报要是搞砸了，我就肯定会被开除。"
    },
    "非黑即白": {
      desc: "只看极端：要么完美，要么彻底失败，看不到中间地带。",
      example: "这次没拿第一，说明我完全不行。"
    },
    "以偏概全": {
      desc: "从单一事件推出普遍结论，用一次经历概括全部。",
      example: "被拒绝了一次，说明我永远不会被接受。"
    },
    "读心术": {
      desc: "在没有证据的情况下，断定自己知道别人在想什么。",
      example: "他没回我消息，一定是讨厌我了。"
    },
    "贴标签": {
      desc: "用一个负面标签定义自己或别人的整体，而不是就事论事。",
      example: "我搞砸了一件事，说明我这个人就是没用。"
    },
    "应该式思维": {
      desc: "用僵化的\u201c应该\u201d\u201c必须\u201d要求自己或别人，达不到就自责或愤怒。",
      example: "我应该随时都保持冷静，这么生气说明我修养很差。"
    },
    "个人化": {
      desc: "把与自己无关的事情或别人的行为，归因到自己身上。",
      example: "今天团队气氛不好，肯定是因为我昨天说的那句话。"
    },
    "情绪化推理": {
      desc: "把感受当成事实：\u201c我感觉是这样，那它就是这样的。\u201d",
      example: "我觉得自己是个负担，所以我肯定就是。"
    }
  };

  export const REVIEW_INSTRUCTION = [
    "请你扮演一个认知重评的审查者，帮我检查下面这些思维记录。你的任务：",
    "1. 对每一条记录，判断\u201c替代想法\u201d是否只是在回避或粉饰真实问题（滑向否认），还是站得住脚的、基于证据的重新理解。",
    "2. 指出哪些替代想法缺乏\u201c支持证据\u201d或\u201c反对证据\u201d栏位里列出的事实支撑。",
    "3. 如果某条记录里的情境本身指向一个可以通过实际行动解决的问题（而不是需要被重新理解的认知偏差），请明确提醒我，而不是帮我继续说服自己。",
    "4. 如果标注了认知扭曲类型，请检查这个归类是否准确，以及替代想法有没有真正对应地纠正这种扭曲模式。",
    "5. 如果有回填结果，请对比当初的自动想法、替代想法、和回填的实际结果，告诉我哪个想法更接近事实，这对我以后的判断有什么参考价值。",
    "6. 请直接、诚实地指出问题，不要为了让我好受而附和我的解读。",
    "",
    "以下是我的记录："
  ].join("\n");

  // Field definitions for the wizard, in order.
// Examples follow one consistent scenario (a friend not replying to a message)
// so the user can see how the same situation flows through the whole record.
export const WIZARD_FIELDS = [
    {
      key: "situation", type: "textarea", prompt: "发生了什么？",
      hint: "只写客观事实，具体的时间、地点、人物，不要写你的解读。",
      example: "周二早上给小夏发了条消息约周末见面，现在是周四晚上九点，她还没回。她今天上线过。"
    },
    {
      key: "automatic_thought", type: "textarea", prompt: "当时脑子里冒出的第一个想法是什么？",
      hint: "尽量用一句话原话写下来，不要修饰。",
      example: "她一定是生我的气了，上次我说的话肯定让她不舒服了。"
    },
    {
      key: "thought_belief_before", type: "slider", prompt: "你有多相信这个想法是真的？",
      hint: "1 = 完全不信，10 = 完全相信",
      example: "如果你八成觉得它是真的，就拖到 8。"
    },
    {
      key: "emotion_label", type: "text", prompt: "这带来了什么情绪？",
      hint: "给它起个名字，可以用常见的词，也可以自己命名。",
      example: "\u201c焦虑\u201d\u201c担心\u201d\u201c失落\u201d\u201c委屈\u201d——哪个词最贴切就用哪个。"
    },
    {
      key: "emotion_intensity_before", type: "slider", prompt: "这个情绪有多强烈？",
      hint: "1 = 很轻微，10 = 非常强烈",
      example: "如果这个感受已经占了你大部分心思，通常在 7 以上。"
    },
    {
      key: "cognitive_distortion", type: "tags", prompt: "如果你觉得这个想法可能有某种固定的思维模式，可以选一个。",
      hint: "点选后会显示每种模式的解释和例子。不确定也没关系，可以跳过。"
    },
    {
      key: "evidence_for", type: "textarea", prompt: "有什么事实支持这个想法？",
      hint: "只写你能观察到的事实，不是你的感受。试着写出最强有力的版本。",
      example: "上周她约我时临时取消过一次；这一周她回我消息一直比平时慢。"
    },
    {
      key: "evidence_against", type: "textarea", prompt: "有什么事实不支持这个想法？",
      hint: "试着找一找，哪怕只有一点点。可以问自己：如果朋友遇到同样的事，我会怎么对他说？",
      example: "她这周在赶一个截止日期，周日还提过；她以前忙的时候也回得慢，但从来没代表什么。"
    },
    {
      key: "alternative_thought", type: "textarea", prompt: "综合两边的证据，有没有一个更平衡、更站得住脚的想法？",
      hint: "不需要完全否定原来的想法，只需要让它更准确。",
      example: "她可能正被截止日期压着，忙完会回我。如果上次的事真的有疙瘩，见面时可以直接聊。"
    },
    {
      key: "thought_belief_after", type: "slider", prompt: "你有多相信这个新的想法？",
      hint: "1 = 完全不信，10 = 完全相信",
      example: "看完两边的证据后，这个新想法在你心里站得住几分？"
    },
    {
      key: "emotion_intensity_after", type: "slider", prompt: "现在重新看这件事，情绪强度变成多少了？",
      hint: "1 = 很轻微，10 = 非常强烈",
      example: "通常会降几格，但不必降到 0——事情还没解决，有一点担心是正常的。"
    }
  ];

