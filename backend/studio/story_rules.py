"""Shared creative contract derived from the user's approved story/profile workflow."""
STORY_RULES = '''Preserve the author's story, causal chain, character names and defining details.
Read the full story before describing a frame or a character. Never drop plot-critical absences,
mistakes, negations or consequences (for example, forgetting to buy sunscreen is not buying sunscreen).
Distinguish facts stated by the author from optional design suggestions. Existing approved profiles win.
Keep species, silhouette, proportions, colors, facial features, left/right asymmetry and signature accessories stable.
Anthropomorphic animals may stand, gesture, talk and use objects like humans while retaining their animal anatomy.
Use an original visual identity in the chosen project style, not a copy of an existing franchise.
Describe appearance separately from personality and observable behavior. Keep one clear everyday outfit;
put swimwear, rainwear and other scene-dependent outfits in named alternatives with when-to-use conditions.
Match all characters to the same rendering, lighting and materials without copying one character's identity onto another.
Keep project rules concise and practical: wanted, avoided, narrative voice, prop continuity and staging.
Do not silently rewrite the plot, add characters or turn a suggestion into an established fact.
No text, watermarks or unrelated props in image prompts unless the user explicitly requests them.'''

FRAME_RULES = STORY_RULES + '''
Write a short usable image prompt in Bosnian Latin script: about 60-130 words, with enough detail for a coherent scene.
Use plain sentences, no headings, Markdown or unnecessary repetition of every profile attribute.
Specify who, one visible action/reaction, location, relevant prop, composition/light and a short reference-continuity instruction.
The selected frames define what must be shown; the rest of the story is continuity context only.
For a connected group return ONE coherent scene, never separate prompts, multiple panels or a storyboard.
Retain the important event even when shortening: if a needed item is forgotten, explicitly mention its absence
and a visible staging cue (e.g. purchased towels/food in the bag, sunscreen not in the bag), without inventing text on screen.
Do not show a character knowingly leaving something behind when the story says they forgot it.
Return only the prompt.'''

PROFILE_RULES = STORY_RULES + '''
Help build ONE complete reusable character profile from the selected story and the user's optional description.
Fill in useful original visual details where unspecified, but keep the provided constraints and existing identity unchanged.
Return a JSON object with these string fields: name, appearance, personality, clothing, prompt; and outfits as an array
of objects with string name and description (up to 4), plus suggestions as a short string listing invented details for review.
appearance: 60-110 Bosnian words covering species/body/silhouette, face, eyes, coat/hair, distinctive features and proportions.
personality: 40-80 Bosnian words combining traits with concrete gestures, gait, emotional reactions and relationships.
clothing: 25-60 Bosnian words describing ONLY the default everyday outfit, colors and signature accessory.
prompt: 70-120 English words summarizing identity, chosen project style, default outfit, neutral pose/background and continuity.
Do not ask for five panels or a specific layout in prompt; the image tool chooses one view or a five-view sheet separately.
Outfits are optional, only for relevant alternative clothes in the story; preserve identity, explain when used.
No age guesses or costume changes that conflict with the user's profile. Do not generate images or claim a design is already approved.
Return valid JSON only, without Markdown fences.'''
