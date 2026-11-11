/**
 * Demo Legacy Book for Thabo Mokoena and his three children (mock mode). Written as a real parent would:
 * plain, specific, a little repetitive. The "lerato-uct-fees" message is tied to the UCT fee payment.
 */
import type { LegacyBook } from "./schema";

export const DEMO_MILESTONE_UCT = "lerato-uct-fees";

export function demoLegacyBook(wallets: Partial<Record<"lerato" | "sipho" | "naledi", string>> = {}): LegacyBook {
  return {
    version: 1,
    ownerName: "Thabo Mokoena",
    calledBy: "Dad",
    pronoun: "he",
    values: [
      "Education is the one thing nobody can take from you.",
      "Look after each other first. Siblings are your first friends and your last.",
      "Work hard, be honest, and greet people properly.",
      "Respect your elders, and remember where you come from: Soweto made us.",
    ],
    lessons: [
      "I left school owing money for books. Pay what you owe before you buy what you want.",
      "Asking for help is not weakness. I wish I had asked sooner.",
      "A bad mark is information, not a verdict.",
    ],
    phrases: [
      "Hamba kahle, and do it properly.",
      "Slowly, slowly catches the monkey.",
      "Lift as you rise.",
      "Phone your gogo on Sunday.",
    ],
    guidance: {
      study: "Go to every lecture, even the early ones. Sit in front. Ask the tutor when you don't understand; that is what they are paid for.",
      money: "Save a little of everything, even R50. Never sign for credit you don't understand, and never lend money you can't lose.",
      faith: "Keep going to church with your mother when you're home, and keep our traditions. Know your clan names and say them with pride.",
      family: "When you fight, sort it out before you sleep. Uncle Bongani is there for you; call him.",
      other: "",
    },
    children: [
      {
        id: "lerato", name: "Lerato", wallet: wallets.lerato,
        guidance: {
          study: "Lerato, you were always the one with the book under the blanket. Finish your degree at UCT, even when Cape Town feels far from home.",
          money: "The fees go straight to UCT, so your job is the small money: budget your allowance on the first of the month.",
          faith: "", family: "You are the eldest now. Look after Sipho and Naledi, but don't carry everything alone.",
          other: "",
        },
        note: "I am so proud of the woman you are becoming.",
      },
      {
        id: "sipho", name: "Sipho", wallet: wallets.sipho,
        guidance: {
          study: "Sipho, you are cleverer than you think. Choose a course you like, not one that sounds impressive.",
          money: "Don't spend your first money on a car. Spend it on your future, then buy the car.",
          faith: "", family: "Help your mother at home. Be the man who washes the dishes without being asked.", other: "",
        },
        note: "You make me laugh every single day.",
      },
      {
        id: "naledi", name: "Naledi", wallet: wallets.naledi,
        guidance: {
          study: "Naledi, keep reading and keep asking why. Finish matric strong and the doors will open.",
          money: "", faith: "",
          family: "Your big sister and brother are always one phone call away.", other: "",
        },
        note: "My little star. That is what your name means, and that is what you are.",
      },
    ],
    milestones: [
      {
        id: DEMO_MILESTONE_UCT, childId: "lerato", kind: "firstFees", title: "Your UCT fees are paid",
        text: "Lerato, if you are hearing this, your fees at UCT have been paid, straight to the university, just like I planned. I couldn't be there to drive you, but I made sure of this. Now go to every lecture, sit in front, and make that degree yours. I am so proud of you, my girl.",
      },
      {
        id: "all-hard-day", childId: "all", kind: "hardDay", title: "For a hard day",
        text: "Some days will be heavy. That's alright. Phone your gogo, phone Uncle Bongani, phone each other. Have something warm to eat and sleep early. Tomorrow you try again. Slowly, slowly catches the monkey.",
      },
      {
        id: "all-graduation", childId: "all", kind: "graduation", title: "Graduation day",
        text: "You did it. Put on that gown and walk across that stage like you own it. Lift as you rise: now help someone else get there too.",
      },
      {
        id: "sipho-first-job", childId: "sipho", kind: "firstJob", title: "Your first job",
        text: "Sipho, your first job! Be early, be polite to the cleaner and the boss the same way, and save something from your first payslip, even a little.",
      },
      {
        id: "naledi-birthday", childId: "naledi", kind: "birthday", title: "Happy birthday, my star",
        text: "Happy birthday, Naledi. Another year of you shining. Eat cake, laugh loud, and phone your gogo.",
      },
    ],
  };
}
