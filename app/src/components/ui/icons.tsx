/**
 * Heirloom icon set: Flaticon UIcons, Regular weight, Rounded style (`fi-rr-*`).
 * Icons: Uicons by Flaticon (flaticon.com/uicons). Free licence, credit required.
 *
 * A drop-in replacement for `lucide-react`: every component keeps its lucide name, so call sites
 * only change their import path. Each one renders a font glyph in a square box that takes its size
 * from the box (`size-4`, `size-5`…) and its colour from `currentColor`.
 *
 * The font is a subset holding only the glyphs this app imports. `npm run icons`
 * (scripts/build-icons.mjs, also run before every build) rebuilds it from this table, so a new
 * icon needs one line in GLYPHS and one export below, then `npm run icons`.
 *
 * Mapping (lucide name -> UIcons glyph). "~" marks a looser match where UIcons has no twin.
 *   Arrows      ArrowDown arrow-down, ArrowUp arrow-up, ArrowLeft arrow-left, ArrowRight arrow-right,
 *               ArrowDownToLine arrow-to-bottom, ArrowUpFromLine arrow-from-bottom,
 *               ExternalLink arrow-up-right-from-square, ChevronDown angle-small-down,
 *               ChevronsUpDown angles-up-down, Undo2 undo, RotateCcw rotate-left,
 *               RefreshCw refresh, Repeat arrows-repeat
 *   Status      Check check, X cross-small, CircleX cross-circle, CircleAlert exclamation,
 *               Info info, TriangleAlert triangle-warning, BadgeCheck badge-check,
 *               CircleDashed circle-dashed, CircleDot dot-circle, Loader2 spinner (spin via class)
 *   Safety      Lock lock, LockOpen unlock, KeyRound key, ShieldCheck shield-check,
 *               ShieldAlert shield-exclamation, ShieldX shield-xmark
 *   Money       Wallet wallet, Banknote money-bill-wave, HandCoins hand-holding-usd,
 *               Landmark bank, Store shop, Scale balance-scale-right
 *   Documents   FileText document, FileUp file-upload, FileCheck2 memo-circle-check ~,
 *               FileHeart envelope-heart ~, FileLock2 signature-lock ~, ScrollText scroll,
 *               PenLine signature, Pencil pencil, Gavel gavel, BookOpen book-open-cover,
 *               BookHeart book-heart, Copy copy-alt, Download download, Trash2 trash,
 *               Delete delete, Inbox inbox
 *   People      UserRound user, UserRoundPlus user-add, Users users, UsersRound users-alt,
 *               HandHeart hand-holding-heart, HeartHandshake heart-partner-handshake
 *   Life        House home, Car car-side, CarFront car, Building2 building,
 *               GraduationCap graduation-cap, Stethoscope stethoscope, HeartPulse heart-rate,
 *               CalendarClock calendar-clock, Clock clock, Hourglass hourglass,
 *               Milestone flag ~, Compass compass-alt, FlaskConical flask, LifeBuoy life-ring
 *   Talk        MessageCircle comment, MessageSquare comment-alt, MessageSquareHeart message-heart,
 *               Send paper-plane, Phone phone-call, PhoneOff phone-slash, Mic microphone,
 *               MicOff microphone-slash, Volume2 volume, Languages language, Bot robot,
 *               ScanSearch search-alt ~
 *   Controls    Play play, Pause pause, Square stop, Power power, Plus plus, Ellipsis menu-dots,
 *               Sparkles sparkles, Zap bolt, Moon moon, Sun sun, CloudOff cloud-disabled,
 *               WifiOff wifi-slash, Search search, Settings settings, Menu menu-burger,
 *               PanelLeft sidebar, LogOut sign-out-alt, ChevronRight angle-small-right,
 *               ChevronLeft angle-small-left, ChevronUp angle-small-up, Mail envelope,
 *               BellRing bell-ring, Paperclip paperclip-vertical,
 *               PanelLeftOpen / PanelLeftClose sidebar (the button label carries the state)
 */
import type { CSSProperties, HTMLAttributes, ReactElement } from "react";
import clsx from "clsx";

export const GLYPHS = {
  ArrowDown: "arrow-down",
  ArrowDownToLine: "arrow-to-bottom",
  ArrowLeft: "arrow-left",
  ArrowRight: "arrow-right",
  ArrowUp: "arrow-up",
  ArrowUpFromLine: "arrow-from-bottom",
  BadgeCheck: "badge-check",
  Banknote: "money-bill-wave",
  BookHeart: "book-heart",
  BookOpen: "book-open-cover",
  Bot: "robot",
  Building2: "building",
  CalendarClock: "calendar-clock",
  Car: "car-side",
  CarFront: "car",
  Check: "check",
  ChevronDown: "angle-small-down",
  ChevronLeft: "angle-small-left",
  ChevronRight: "angle-small-right",
  ChevronUp: "angle-small-up",
  ChevronsUpDown: "angles-up-down",
  CircleAlert: "exclamation",
  CircleDashed: "circle-dashed",
  CircleDot: "dot-circle",
  CircleX: "cross-circle",
  Clock: "clock",
  CloudOff: "cloud-disabled",
  Compass: "compass-alt",
  Copy: "copy-alt",
  Delete: "delete",
  Download: "download",
  Ellipsis: "menu-dots",
  ExternalLink: "arrow-up-right-from-square",
  FileCheck2: "memo-circle-check",
  FileHeart: "envelope-heart",
  FileLock2: "signature-lock",
  FileText: "document",
  FileUp: "file-upload",
  FlaskConical: "flask",
  Gavel: "gavel",
  GraduationCap: "graduation-cap",
  HandCoins: "hand-holding-usd",
  HandHeart: "hand-holding-heart",
  HeartHandshake: "heart-partner-handshake",
  HeartPulse: "heart-rate",
  Hourglass: "hourglass",
  House: "home",
  Inbox: "inbox",
  Info: "info",
  KeyRound: "key",
  Landmark: "bank",
  Languages: "language",
  LifeBuoy: "life-ring",
  Loader2: "spinner",
  Lock: "lock",
  LockOpen: "unlock",
  LogOut: "sign-out-alt",
  Mail: "envelope",
  Menu: "menu-burger",
  MessageCircle: "comment",
  MessageSquare: "comment-alt",
  MessageSquareHeart: "message-heart",
  Mic: "microphone",
  MicOff: "microphone-slash",
  Milestone: "flag",
  Moon: "moon",
  PanelLeft: "sidebar",
  Pause: "pause",
  PenLine: "signature",
  Pencil: "pencil",
  Phone: "phone-call",
  PhoneOff: "phone-slash",
  Play: "play",
  Plus: "plus",
  Power: "power",
  RefreshCw: "refresh",
  Repeat: "arrows-repeat",
  RotateCcw: "rotate-left",
  Scale: "balance-scale-right",
  ScanSearch: "search-alt",
  ScrollText: "scroll",
  Search: "search",
  Send: "paper-plane",
  Settings: "settings",
  ShieldAlert: "shield-exclamation",
  ShieldCheck: "shield-check",
  ShieldX: "shield-xmark",
  Sparkles: "sparkles",
  Square: "stop",
  Stethoscope: "stethoscope",
  Store: "shop",
  Sun: "sun",
  Trash2: "trash",
  TriangleAlert: "triangle-warning",
  Undo2: "undo",
  UserRound: "user",
  UserRoundPlus: "user-add",
  Users: "users",
  UsersRound: "users-alt",
  Volume2: "volume",
  Wallet: "wallet",
  WifiOff: "wifi-slash",
  X: "cross-small",
  Zap: "bolt",
  BellRing: "bell-ring",
  PanelLeftClose: "sidebar",
  PanelLeftOpen: "sidebar",
  Paperclip: "paperclip-vertical",
} as const;

export type IconName = keyof typeof GLYPHS;

export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Lucide compatibility: pixel or CSS size for the box. Tailwind `size-*` classes are preferred. */
  size?: number | string;
  /** Lucide compatibility: font glyphs have a fixed stroke, so this is accepted and ignored. */
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  color?: string;
};

/** Same role as lucide's `LucideIcon`: any icon component from this module. */
export type IconComponent = ((props: IconProps) => ReactElement) & { displayName?: string };
export type LucideIcon = IconComponent;

function make(name: IconName): IconComponent {
  const glyph = GLYPHS[name];
  function Icon({ className, size, strokeWidth: _s, absoluteStrokeWidth: _a, color, style, ...rest }: IconProps) {
    void _s;
    void _a;
    const label = rest["aria-label"];
    const box: CSSProperties | undefined =
      size != null || color ? { ...(size != null ? { width: size, height: size } : null), ...(color ? { color } : null), ...style } : style;
    return (
      <span
        aria-hidden={label ? undefined : true}
        role={label ? "img" : undefined}
        {...rest}
        className={clsx("ui-icon", className)}
        style={box}
      >
        <i className={`fi fi-rr-${glyph}`} />
      </span>
    );
  }
  Icon.displayName = name;
  return Icon;
}

export const ArrowDown = make("ArrowDown");
export const ArrowDownToLine = make("ArrowDownToLine");
export const ArrowLeft = make("ArrowLeft");
export const ArrowRight = make("ArrowRight");
export const ArrowUp = make("ArrowUp");
export const ArrowUpFromLine = make("ArrowUpFromLine");
export const BadgeCheck = make("BadgeCheck");
export const Banknote = make("Banknote");
export const BookHeart = make("BookHeart");
export const BookOpen = make("BookOpen");
export const Bot = make("Bot");
export const Building2 = make("Building2");
export const CalendarClock = make("CalendarClock");
export const Car = make("Car");
export const CarFront = make("CarFront");
export const Check = make("Check");
export const ChevronDown = make("ChevronDown");
export const ChevronLeft = make("ChevronLeft");
export const ChevronRight = make("ChevronRight");
export const ChevronUp = make("ChevronUp");
export const ChevronsUpDown = make("ChevronsUpDown");
export const CircleAlert = make("CircleAlert");
export const CircleDashed = make("CircleDashed");
export const CircleDot = make("CircleDot");
export const CircleX = make("CircleX");
export const Clock = make("Clock");
export const CloudOff = make("CloudOff");
export const Compass = make("Compass");
export const Copy = make("Copy");
export const Delete = make("Delete");
export const Download = make("Download");
export const Ellipsis = make("Ellipsis");
export const ExternalLink = make("ExternalLink");
export const FileCheck2 = make("FileCheck2");
export const FileHeart = make("FileHeart");
export const FileLock2 = make("FileLock2");
export const FileText = make("FileText");
export const FileUp = make("FileUp");
export const FlaskConical = make("FlaskConical");
export const Gavel = make("Gavel");
export const GraduationCap = make("GraduationCap");
export const HandCoins = make("HandCoins");
export const HandHeart = make("HandHeart");
export const HeartHandshake = make("HeartHandshake");
export const HeartPulse = make("HeartPulse");
export const Hourglass = make("Hourglass");
export const House = make("House");
export const Inbox = make("Inbox");
export const Info = make("Info");
export const KeyRound = make("KeyRound");
export const Landmark = make("Landmark");
export const Languages = make("Languages");
export const LifeBuoy = make("LifeBuoy");
export const Loader2 = make("Loader2");
export const Lock = make("Lock");
export const LockOpen = make("LockOpen");
export const LogOut = make("LogOut");
export const Mail = make("Mail");
export const Menu = make("Menu");
export const MessageCircle = make("MessageCircle");
export const MessageSquare = make("MessageSquare");
export const MessageSquareHeart = make("MessageSquareHeart");
export const Mic = make("Mic");
export const MicOff = make("MicOff");
export const Milestone = make("Milestone");
export const Moon = make("Moon");
export const PanelLeft = make("PanelLeft");
export const Pause = make("Pause");
export const PenLine = make("PenLine");
export const Pencil = make("Pencil");
export const Phone = make("Phone");
export const PhoneOff = make("PhoneOff");
export const Play = make("Play");
export const Plus = make("Plus");
export const Power = make("Power");
export const RefreshCw = make("RefreshCw");
export const Repeat = make("Repeat");
export const RotateCcw = make("RotateCcw");
export const Scale = make("Scale");
export const ScanSearch = make("ScanSearch");
export const ScrollText = make("ScrollText");
export const Search = make("Search");
export const Send = make("Send");
export const Settings = make("Settings");
export const ShieldAlert = make("ShieldAlert");
export const ShieldCheck = make("ShieldCheck");
export const ShieldX = make("ShieldX");
export const Sparkles = make("Sparkles");
export const Square = make("Square");
export const Stethoscope = make("Stethoscope");
export const Store = make("Store");
export const Sun = make("Sun");
export const Trash2 = make("Trash2");
export const TriangleAlert = make("TriangleAlert");
export const Undo2 = make("Undo2");
export const UserRound = make("UserRound");
export const UserRoundPlus = make("UserRoundPlus");
export const Users = make("Users");
export const UsersRound = make("UsersRound");
export const Volume2 = make("Volume2");
export const Wallet = make("Wallet");
export const WifiOff = make("WifiOff");
export const X = make("X");
export const Zap = make("Zap");
export const BellRing = make("BellRing");
export const PanelLeftClose = make("PanelLeftClose");
export const PanelLeftOpen = make("PanelLeftOpen");
export const Paperclip = make("Paperclip");
