package com.maverick.boardgames.tv

/**
 * The announcers are men (the CEO, 2026-10-18: "I need men announcers"): which of the device's text-to-speech voices may speak, and the two
 * that do. Pure Kotlin with no Android types, so the rules can be run on a plain JVM; MainActivity feeds it the installed offline English
 * voices. These are the same rules, lists and ranking as ui/voice.js (the browser's voices): keep the two in step.
 *
 * A voice is a man's only when it is NAMED as one: a Google voice code or a first name on the men's list below (or a "male" mark, or
 * Samsung's "SMTm" voices). A voice that is not known is never used, and a voice on the women's list is never used even when its name also
 * matches a man's. Nothing is guessed from the pitch and nothing is pitch-shifted: no man's voice installed = no speech (the page shows
 * captions), a woman's voice is never the fallback.
 *
 * Where the gender facts come from: Google's own voice manifest (dl.google.com/android/tts/v3/voices-list-r3.proto: en-gb-x-rjs male,
 * en-gb-x-fis and en-us-x-sfg female), the Readium speech voice list (github.com/readium/speech, json/en.json) for the newer Google codes,
 * and the Apple and Microsoft voice names. (Chrome OS's "Google US English 4 (Natural)" style names exist only in a browser: only
 * ui/voice.js has those; the lists of names and codes below are the same in both files.)
 */
object MenVoices {
    /** One installed offline English voice. [ref] is whatever the caller wants back (MainActivity: the android.speech.tts.Voice). */
    class Cand<T>(val ref: T, val name: String, val lang: String, val quality: Int)

    /** [men]: every man's voice, best first. [a]: the lead caller. [b]: the analyst, another man (null when the device has only one). */
    class Pick<T>(val men: List<Cand<T>>, val a: Cand<T>?, val b: Cand<T>?)

    /** What a voice's name says about its speaker; [person] tells two voices of one man apart from two men. */
    class Who(val gender: Int, val person: String, val bonus: Int)

    const val MAN = 1
    const val WOMAN = -1
    const val UNKNOWN = 0

    private fun words(s: String): Set<String> = s.split(" ").filter { it.isNotEmpty() }.toSet()

    /** men's first names: Apple, then Windows, then Amazon / Polly style, then Edge "Online (Natural)" (network voices, never installed on a device) */
    private val maleNames = words(
        "aaron alex aman arthur daniel evan gordon jamie lee nathan oliver rishi tom " +
            "david mark george james richard ravi sean " +
            "joey matthew stephen gregory russell geraint brian eric " +
            "andrew guy steffan christopher roger ryan thomas william liam prabhat connor luke chilemba mitchell abeo wayne elimu"
    )

    /** women's names: a voice with one of these is left out for good, even when it also matches a man's name */
    private val femaleNames = words(
        "samantha victoria vicki karen moira tessa fiona veena kate serena susan allison ava nicky zoe joelle noelle stephanie martha matilda catherine isha tara sangeeta kathy agnes " +
            "zira hazel linda heera eva " +
            "aria jenny michelle ana emma sonia libby maisie natasha hayley clara heather neerja emily leah yan asilia molly ezinne rosa luna imani " +
            "amy nicole olivia salli joanna kendra kimberly ivy raveena aditi niamh gwyneth ayanda lisa bixby " +
            "female woman girl"
    )

    /** Google's on-device voices (Speech Services by Google): the three letters after "-x-" are the voice */
    private val maleCodes = words("en-us-x-iom en-us-x-iol en-us-x-tpd en-gb-x-rjs en-gb-x-gbb en-gb-x-gbd en-au-x-aub en-au-x-aud en-in-x-end en-in-x-ene")
    private val femaleCodes = words("en-us-x-tpc en-us-x-iob en-us-x-iog en-us-x-tpf en-us-x-sfg en-gb-x-fis en-gb-x-gba en-gb-x-gbc en-gb-x-gbg en-au-x-aua en-au-x-auc en-in-x-ena en-in-x-enc en-in-x-ahp")

    private val siriMen = words("aaron arthur gordon")

    private val codeRe = Regex("""\b([a-z]{2,3}-[a-z]{2,4})-x-([a-z]{3})\b""")
    private val variantRe = Regex("""(?:([a-z]{2,3}-[a-z]{2,4}-x-[a-z]{3}))?#(fe)?male_?(\d*)""")
    private val tokenRe = Regex("""[^a-z0-9]+""")
    private val smtFemaleRe = Regex("""^smtf\d""")
    private val smtMaleRe = Regex("""^smtm\d""")
    private val junkRe = Regex("""[^a-z0-9]+""")

    /** What the voice's [rawName] (Android's Voice.getName(), e.g. "en-us-x-iom-local") says about who speaks. */
    fun who(rawName: String): Who {
        val n = rawName.lowercase()
        val c = codeRe.find(n)
        val code = if (c != null) c.groupValues[1] + "-x-" + c.groupValues[2] else ""
        // Google's own variant label ("en-us-x-sfg#male_1" = a male variant of a base voice, whatever the base voice is) says it outright
        val m = variantRe.find(n)
        if (m != null) {
            val fem = m.groupValues[2].isNotEmpty()
            return Who(if (fem) WOMAN else MAN, m.groupValues[1] + "#" + m.groupValues[2] + "male" + m.groupValues[3], -30)
        }
        // women first: any sign of a woman's voice leaves it out for good
        if (code in femaleCodes) return Who(WOMAN, "", 0)
        val toks = n.split(tokenRe).filter { it.isNotEmpty() }
        if (toks.any { it in femaleNames || smtFemaleRe.containsMatchIn(it) }) return Who(WOMAN, "", 0)
        if (code in maleCodes) return Who(MAN, code, 12 + (if (code == "en-us-x-iom") 5 else if (code == "en-us-x-iol") 4 else 0))
        var man = false
        for (t in toks) {
            if (t in maleNames) return Who(MAN, t, if (t == "alex") 20 else if (t in siriMen) 4 else 0)
            if (t == "male" || smtMaleRe.containsMatchIn(t)) man = true
        }
        if (man) return Who(MAN, n.replace(junkRe, " ").trim(), 0)
        return Who(UNKNOWN, "", 0)
    }

    /** The ranking among men (higher is better; -1 = not a man's voice we can use): the accent, then the engine's own quality grade. */
    fun rank(name: String, lang: String, quality: Int): Int {
        val l = lang.lowercase().replace('_', '-')
        if (l != "en" && !l.startsWith("en-")) return -1   // English only (the caller already passes English voices; this keeps the rule the same as ui/voice.js)
        val w = who(name)
        if (w.gender != MAN) return -1
        var s = 100 + (quality - 300) / 10 + w.bonus
        s += if (l == "en-us") 30
        else if (l == "en-gb") 26
        else if (l.startsWith("en-au") || l.startsWith("en-ca") || l.startsWith("en-ie") || l.startsWith("en-nz")) 18
        else 10
        return s
    }

    private class Ranked<T>(val cand: Cand<T>, val score: Int)

    /** The men among [all], best first; the caller is the best, the analyst the best OTHER man (two voices of one name are one man). */
    fun <T> pick(all: List<Cand<T>>): Pick<T> {
        val ranked = all.map { Ranked(it, rank(it.name, it.lang, it.quality)) }
            .filter { it.score >= 0 }
            .sortedWith(compareBy<Ranked<T>>({ -it.score }, { it.cand.name }))
        val men = ranked.map { it.cand }
        val a = men.firstOrNull()
        val b = if (a == null) null else men.firstOrNull { who(it.name).person != who(a.name).person }
        return Pick(men, a, b)
    }
}
