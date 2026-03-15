--
-- PostgreSQL database dump
--

\restrict 817EMfxwkT08FrpaWyueSTMvZudLRaFA7yfMiVrxqaQFTb3dSW80sh0kKgolsPD

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: measurement_type; Type: TYPE; Schema: public; Owner: equipment_user
--

CREATE TYPE public.measurement_type AS ENUM (
    '4-20mA',
    '0-10V',
    'other',
    '4-20mA (AI)',
    '0-20mA (AI)',
    '0-10V (AI)',
    'Pt100 (RTD AI)',
    'Pt1000 (RTD AI)',
    'M50 (RTD AI)',
    '24V (DI)',
    '220V (DI)',
    '8-16mA (DI)'
);


ALTER TYPE public.measurement_type OWNER TO equipment_user;

--
-- Name: movement_type; Type: TYPE; Schema: public; Owner: equipment_user
--

CREATE TYPE public.movement_type AS ENUM (
    'inbound',
    'transfer',
    'to_cabinet',
    'from_cabinet',
    'direct_to_cabinet',
    'writeoff',
    'adjustment',
    'to_warehouse',
    'to_assembly',
    'direct_to_assembly'
);


ALTER TYPE public.movement_type OWNER TO equipment_user;

--
-- Name: signal_type; Type: TYPE; Schema: public; Owner: equipment_user
--

CREATE TYPE public.signal_type AS ENUM (
    'AI',
    'AO',
    'DI',
    'DO'
);


ALTER TYPE public.signal_type OWNER TO equipment_user;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: equipment_user
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'engineer',
    'viewer'
);


ALTER TYPE public.user_role OWNER TO equipment_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(255) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO equipment_user;

--
-- Name: assemblies; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.assemblies (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    location_id integer,
    meta_data jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    factory_number character varying(100),
    nomenclature_number character varying(100)
);


ALTER TABLE public.assemblies OWNER TO equipment_user;

--
-- Name: assemblies_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.assemblies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assemblies_id_seq OWNER TO equipment_user;

--
-- Name: assemblies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.assemblies_id_seq OWNED BY public.assemblies.id;


--
-- Name: assembly_items; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.assembly_items (
    id integer NOT NULL,
    assembly_id integer NOT NULL,
    equipment_type_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assembly_items OWNER TO equipment_user;

--
-- Name: assembly_items_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.assembly_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assembly_items_id_seq OWNER TO equipment_user;

--
-- Name: assembly_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.assembly_items_id_seq OWNED BY public.assembly_items.id;


--
-- Name: attachments; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.attachments (
    id integer NOT NULL,
    entity character varying(64) NOT NULL,
    entity_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    content_type character varying(100) NOT NULL,
    size_bytes integer NOT NULL,
    storage_path character varying(500) NOT NULL,
    uploaded_by_id integer NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.attachments OWNER TO equipment_user;

--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attachments_id_seq OWNER TO equipment_user;

--
-- Name: attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    actor_id integer NOT NULL,
    action character varying(32) NOT NULL,
    entity character varying(64) NOT NULL,
    entity_id integer,
    before jsonb,
    after jsonb,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO equipment_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO equipment_user;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cabinet_files; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.cabinet_files (
    id integer NOT NULL,
    cabinet_id integer NOT NULL,
    original_name character varying(255) NOT NULL,
    stored_name character varying(255) NOT NULL,
    ext character varying(20) NOT NULL,
    size_bytes integer NOT NULL,
    mime character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    created_by_id integer NOT NULL
);


ALTER TABLE public.cabinet_files OWNER TO equipment_user;

--
-- Name: cabinet_files_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.cabinet_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cabinet_files_id_seq OWNER TO equipment_user;

--
-- Name: cabinet_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.cabinet_files_id_seq OWNED BY public.cabinet_files.id;


--
-- Name: cabinet_items; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.cabinet_items (
    id integer NOT NULL,
    cabinet_id integer NOT NULL,
    equipment_type_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cabinet_items OWNER TO equipment_user;

--
-- Name: cabinet_items_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.cabinet_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cabinet_items_id_seq OWNER TO equipment_user;

--
-- Name: cabinet_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.cabinet_items_id_seq OWNED BY public.cabinet_items.id;


--
-- Name: cabinets; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.cabinets (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    location_id integer,
    meta_data jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    factory_number character varying(100),
    nomenclature_number character varying(100)
);


ALTER TABLE public.cabinets OWNER TO equipment_user;

--
-- Name: cabinets_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.cabinets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cabinets_id_seq OWNER TO equipment_user;

--
-- Name: cabinets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.cabinets_id_seq OWNED BY public.cabinets.id;


--
-- Name: data_types; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.data_types (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    parent_id integer,
    tooltip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.data_types OWNER TO equipment_user;

--
-- Name: data_types_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.data_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_types_id_seq OWNER TO equipment_user;

--
-- Name: data_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.data_types_id_seq OWNED BY public.data_types.id;


--
-- Name: equipment_categories; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.equipment_categories (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.equipment_categories OWNER TO equipment_user;

--
-- Name: equipment_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.equipment_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipment_categories_id_seq OWNER TO equipment_user;

--
-- Name: equipment_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.equipment_categories_id_seq OWNED BY public.equipment_categories.id;


--
-- Name: equipment_movements; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.equipment_movements (
    id integer NOT NULL,
    movement_type public.movement_type NOT NULL,
    equipment_type_id integer NOT NULL,
    quantity integer NOT NULL,
    from_warehouse_id integer,
    to_warehouse_id integer,
    from_cabinet_id integer,
    to_cabinet_id integer,
    reference character varying(200),
    comment character varying(1000),
    performed_by_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    to_assembly_id integer,
    CONSTRAINT ck_equipment_movements_qty_positive CHECK ((quantity > 0))
);


ALTER TABLE public.equipment_movements OWNER TO equipment_user;

--
-- Name: equipment_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.equipment_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipment_movements_id_seq OWNER TO equipment_user;

--
-- Name: equipment_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.equipment_movements_id_seq OWNED BY public.equipment_movements.id;


--
-- Name: equipment_types; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.equipment_types (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    nomenclature_number character varying(100) NOT NULL,
    manufacturer_id integer NOT NULL,
    is_channel_forming boolean DEFAULT false NOT NULL,
    channel_count integer DEFAULT 0 NOT NULL,
    meta_data jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    equipment_category_id integer,
    ai_count integer DEFAULT 0 NOT NULL,
    di_count integer DEFAULT 0 NOT NULL,
    ao_count integer DEFAULT 0 NOT NULL,
    do_count integer DEFAULT 0 NOT NULL,
    is_network boolean DEFAULT false NOT NULL,
    network_ports jsonb,
    article character varying(100),
    has_serial_interfaces boolean DEFAULT false NOT NULL,
    serial_ports jsonb DEFAULT '[]'::jsonb NOT NULL,
    photo_filename character varying(255),
    photo_mime character varying(100),
    datasheet_filename character varying(255),
    datasheet_mime character varying(100),
    datasheet_original_name character varying(255)
);


ALTER TABLE public.equipment_types OWNER TO equipment_user;

--
-- Name: equipment_types_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.equipment_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.equipment_types_id_seq OWNER TO equipment_user;

--
-- Name: equipment_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.equipment_types_id_seq OWNED BY public.equipment_types.id;


--
-- Name: field_equipments; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.field_equipments (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    parent_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.field_equipments OWNER TO equipment_user;

--
-- Name: field_equipments_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.field_equipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.field_equipments_id_seq OWNER TO equipment_user;

--
-- Name: field_equipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.field_equipments_id_seq OWNED BY public.field_equipments.id;


--
-- Name: io_signals; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.io_signals (
    id integer NOT NULL,
    equipment_in_operation_id integer NOT NULL,
    signal_type public.signal_type NOT NULL,
    channel_index integer NOT NULL,
    tag character varying(200),
    signal character varying(500),
    signal_kind_id integer,
    measurement_type public.measurement_type,
    measurement_unit_id integer,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.io_signals OWNER TO equipment_user;

--
-- Name: io_signals_legacy; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.io_signals_legacy (
    id integer NOT NULL,
    cabinet_component_id integer NOT NULL,
    tag_name character varying(200),
    signal_name character varying(500),
    plc_channel_address character varying(100),
    signal_type public.signal_type NOT NULL,
    measurement_type public.measurement_type NOT NULL,
    terminal_connection character varying(100),
    sensor_range character varying(100),
    engineering_units character varying(50),
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    measurement_unit_id integer
);


ALTER TABLE public.io_signals_legacy OWNER TO equipment_user;

--
-- Name: io_signals_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.io_signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.io_signals_id_seq OWNER TO equipment_user;

--
-- Name: io_signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.io_signals_id_seq OWNED BY public.io_signals_legacy.id;


--
-- Name: io_signals_id_seq1; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.io_signals_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.io_signals_id_seq1 OWNER TO equipment_user;

--
-- Name: io_signals_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.io_signals_id_seq1 OWNED BY public.io_signals.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    parent_id integer,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.locations OWNER TO equipment_user;

--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO equipment_user;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: main_equipment; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.main_equipment (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    parent_id integer,
    level integer NOT NULL,
    code character varying(50) NOT NULL,
    meta_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.main_equipment OWNER TO equipment_user;

--
-- Name: main_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.main_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.main_equipment_id_seq OWNER TO equipment_user;

--
-- Name: main_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.main_equipment_id_seq OWNED BY public.main_equipment.id;


--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.manufacturers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    country character varying(100) NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.manufacturers OWNER TO equipment_user;

--
-- Name: manufacturers_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.manufacturers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.manufacturers_id_seq OWNER TO equipment_user;

--
-- Name: manufacturers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.manufacturers_id_seq OWNED BY public.manufacturers.id;


--
-- Name: measurement_units; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.measurement_units (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    parent_id integer,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.measurement_units OWNER TO equipment_user;

--
-- Name: measurement_units_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.measurement_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.measurement_units_id_seq OWNER TO equipment_user;

--
-- Name: measurement_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.measurement_units_id_seq OWNED BY public.measurement_units.id;


--
-- Name: personnel; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.personnel (
    id integer NOT NULL,
    user_id integer,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    middle_name character varying(100),
    "position" character varying(200) NOT NULL,
    personnel_number character varying(50),
    service character varying(200),
    shop character varying(200),
    department character varying(200),
    division character varying(200),
    birth_date date,
    hire_date date,
    organisation character varying(200),
    email character varying(200),
    phone character varying(50),
    notes text,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.personnel OWNER TO equipment_user;

--
-- Name: personnel_competencies; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.personnel_competencies (
    id integer NOT NULL,
    personnel_id integer NOT NULL,
    name character varying(200) NOT NULL,
    organisation character varying(200),
    city character varying(200),
    completion_date date,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.personnel_competencies OWNER TO equipment_user;

--
-- Name: personnel_competencies_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.personnel_competencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personnel_competencies_id_seq OWNER TO equipment_user;

--
-- Name: personnel_competencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.personnel_competencies_id_seq OWNED BY public.personnel_competencies.id;


--
-- Name: personnel_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.personnel_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personnel_id_seq OWNER TO equipment_user;

--
-- Name: personnel_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.personnel_id_seq OWNED BY public.personnel.id;


--
-- Name: personnel_trainings; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.personnel_trainings (
    id integer NOT NULL,
    personnel_id integer NOT NULL,
    name character varying(200) NOT NULL,
    completion_date date,
    next_due_date date,
    reminder_offset_days integer DEFAULT 0 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.personnel_trainings OWNER TO equipment_user;

--
-- Name: personnel_trainings_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.personnel_trainings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personnel_trainings_id_seq OWNER TO equipment_user;

--
-- Name: personnel_trainings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.personnel_trainings_id_seq OWNED BY public.personnel_trainings.id;


--
-- Name: pid_processes; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.pid_processes (
    id integer NOT NULL,
    location_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.pid_processes OWNER TO equipment_user;

--
-- Name: pid_processes_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.pid_processes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pid_processes_id_seq OWNER TO equipment_user;

--
-- Name: pid_processes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.pid_processes_id_seq OWNED BY public.pid_processes.id;


--
-- Name: signal_types; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.signal_types (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    parent_id integer,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.signal_types OWNER TO equipment_user;

--
-- Name: signal_types_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.signal_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.signal_types_id_seq OWNER TO equipment_user;

--
-- Name: signal_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.signal_types_id_seq OWNED BY public.signal_types.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_token_hash character varying(255) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    end_reason character varying(32),
    ip_address character varying(64),
    user_agent character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO equipment_user;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO equipment_user;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(64) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role NOT NULL,
    last_login_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO equipment_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO equipment_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: warehouse_items; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.warehouse_items (
    id integer NOT NULL,
    warehouse_id integer NOT NULL,
    equipment_type_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_accounted boolean DEFAULT true NOT NULL
);


ALTER TABLE public.warehouse_items OWNER TO equipment_user;

--
-- Name: warehouse_items_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.warehouse_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warehouse_items_id_seq OWNER TO equipment_user;

--
-- Name: warehouse_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.warehouse_items_id_seq OWNED BY public.warehouse_items.id;


--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: equipment_user
--

CREATE TABLE public.warehouses (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    location_id integer,
    meta_data jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_id integer,
    row_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.warehouses OWNER TO equipment_user;

--
-- Name: warehouses_id_seq; Type: SEQUENCE; Schema: public; Owner: equipment_user
--

CREATE SEQUENCE public.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warehouses_id_seq OWNER TO equipment_user;

--
-- Name: warehouses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: equipment_user
--

ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;


--
-- Name: assemblies id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assemblies ALTER COLUMN id SET DEFAULT nextval('public.assemblies_id_seq'::regclass);


--
-- Name: assembly_items id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assembly_items ALTER COLUMN id SET DEFAULT nextval('public.assembly_items_id_seq'::regclass);


--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cabinet_files id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_files ALTER COLUMN id SET DEFAULT nextval('public.cabinet_files_id_seq'::regclass);


--
-- Name: cabinet_items id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_items ALTER COLUMN id SET DEFAULT nextval('public.cabinet_items_id_seq'::regclass);


--
-- Name: cabinets id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinets ALTER COLUMN id SET DEFAULT nextval('public.cabinets_id_seq'::regclass);


--
-- Name: data_types id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.data_types ALTER COLUMN id SET DEFAULT nextval('public.data_types_id_seq'::regclass);


--
-- Name: equipment_categories id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_categories ALTER COLUMN id SET DEFAULT nextval('public.equipment_categories_id_seq'::regclass);


--
-- Name: equipment_movements id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements ALTER COLUMN id SET DEFAULT nextval('public.equipment_movements_id_seq'::regclass);


--
-- Name: equipment_types id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_types ALTER COLUMN id SET DEFAULT nextval('public.equipment_types_id_seq'::regclass);


--
-- Name: field_equipments id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.field_equipments ALTER COLUMN id SET DEFAULT nextval('public.field_equipments_id_seq'::regclass);


--
-- Name: io_signals id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals ALTER COLUMN id SET DEFAULT nextval('public.io_signals_id_seq1'::regclass);


--
-- Name: io_signals_legacy id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals_legacy ALTER COLUMN id SET DEFAULT nextval('public.io_signals_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: main_equipment id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.main_equipment ALTER COLUMN id SET DEFAULT nextval('public.main_equipment_id_seq'::regclass);


--
-- Name: manufacturers id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.manufacturers ALTER COLUMN id SET DEFAULT nextval('public.manufacturers_id_seq'::regclass);


--
-- Name: measurement_units id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.measurement_units ALTER COLUMN id SET DEFAULT nextval('public.measurement_units_id_seq'::regclass);


--
-- Name: personnel id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel ALTER COLUMN id SET DEFAULT nextval('public.personnel_id_seq'::regclass);


--
-- Name: personnel_competencies id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_competencies ALTER COLUMN id SET DEFAULT nextval('public.personnel_competencies_id_seq'::regclass);


--
-- Name: personnel_trainings id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_trainings ALTER COLUMN id SET DEFAULT nextval('public.personnel_trainings_id_seq'::regclass);


--
-- Name: pid_processes id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.pid_processes ALTER COLUMN id SET DEFAULT nextval('public.pid_processes_id_seq'::regclass);


--
-- Name: signal_types id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.signal_types ALTER COLUMN id SET DEFAULT nextval('public.signal_types_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: warehouse_items id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouse_items ALTER COLUMN id SET DEFAULT nextval('public.warehouse_items_id_seq'::regclass);


--
-- Name: warehouses id; Type: DEFAULT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.alembic_version (version_num) FROM stdin;
0028_backfill_unique_equipment_instances
\.


--
-- Data for Name: assemblies; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.assemblies (id, name, location_id, meta_data, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at, factory_number, nomenclature_number) FROM stdin;
1	Сборка 1	1	\N	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	\N	\N
\.


--
-- Data for Name: assembly_items; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.assembly_items (id, assembly_id, equipment_type_id, quantity, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	1	1	1	t	2026-03-14 12:08:50.799639+03	1	2	2026-03-13 22:25:38.647172+03	2026-03-14 15:08:50.797324+03
2	1	1	1	t	2026-03-14 12:08:50.799639+03	1	2	2026-03-13 22:25:38.647172+03	2026-03-14 15:08:50.797324+03
\.


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.attachments (id, entity, entity_id, filename, content_type, size_bytes, storage_path, uploaded_by_id, is_deleted, deleted_at, deleted_by_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.audit_logs (id, actor_id, action, entity, entity_id, before, after, meta, created_at, updated_at) FROM stdin;
1	1	LOGIN	users	1	null	{"id": 1, "role": "admin", "username": "admin", "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-13T22:25:38.647172+03:00", "row_version": 1, "deleted_by_id": null, "last_login_at": "2026-03-14T12:06:59.507669"}	{"ip": "127.0.0.1", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"}	2026-03-14 15:06:59.042785+03	2026-03-14 15:06:59.042785+03
2	1	CREATE	cabinets	1	null	{"id": 1, "name": "ШК1", "meta_data": null, "created_at": "2026-03-14T15:08:42.798382+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T15:08:42.798382+03:00", "location_id": 1, "row_version": 1, "deleted_by_id": null, "factory_number": "13241", "nomenclature_number": "21443234"}	null	2026-03-14 15:08:42.798382+03	2026-03-14 15:08:42.798382+03
3	1	DELETE	assembly_items	1	{"id": 1, "quantity": 2, "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-13T22:25:38.647172+03:00", "assembly_id": 1, "row_version": 1, "deleted_by_id": null, "equipment_type_id": 1}	{"id": 1, "quantity": 2, "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": "2026-03-14T12:08:50.799639", "is_deleted": true, "updated_at": "2026-03-13T22:25:38.647172+03:00", "assembly_id": 1, "row_version": 1, "deleted_by_id": 1, "equipment_type_id": 1}	null	2026-03-14 15:08:50.797324+03	2026-03-14 15:08:50.797324+03
4	1	DIRECT_TO_CABINET	equipment_movements	1	null	{"id": 1, "comment": null, "quantity": 1, "reference": null, "created_at": "2026-03-14T15:09:28.819387+03:00", "updated_at": "2026-03-14T15:09:28.819387+03:00", "movement_type": "direct_to_cabinet", "to_cabinet_id": 1, "to_assembly_id": null, "from_cabinet_id": null, "performed_by_id": 1, "to_warehouse_id": null, "equipment_type_id": 1, "from_warehouse_id": null}	null	2026-03-14 15:09:28.819387+03	2026-03-14 15:09:28.819387+03
5	1	DIRECT_TO_CABINET	equipment_movements	2	null	{"id": 2, "comment": null, "quantity": 1, "reference": null, "created_at": "2026-03-14T15:09:37.976007+03:00", "updated_at": "2026-03-14T15:09:37.976007+03:00", "movement_type": "direct_to_cabinet", "to_cabinet_id": 1, "to_assembly_id": null, "from_cabinet_id": null, "performed_by_id": 1, "to_warehouse_id": null, "equipment_type_id": 1, "from_warehouse_id": null}	null	2026-03-14 15:09:37.976007+03	2026-03-14 15:09:37.976007+03
6	1	LOGIN	users	1	null	{"id": 1, "role": "admin", "username": "admin", "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T15:06:59.042785+03:00", "row_version": 2, "deleted_by_id": null, "last_login_at": "2026-03-14T13:07:42.672688"}	{"ip": "127.0.0.1", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"}	2026-03-14 16:07:42.226939+03	2026-03-14 16:07:42.226939+03
7	1	CREATE	users	2	null	{"id": 2, "role": "engineer", "username": "eng", "created_at": "2026-03-14T16:08:52.428762+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:08:52.428762+03:00", "row_version": 1, "deleted_by_id": null, "last_login_at": null}	null	2026-03-14 16:08:52.428762+03	2026-03-14 16:08:52.428762+03
8	1	CREATE	personnel	2	null	{"id": 2, "shop": null, "email": null, "notes": null, "phone": null, "service": null, "user_id": 2, "division": null, "position": "Админ", "hire_date": null, "last_name": "Админский", "birth_date": null, "created_at": "2026-03-14T16:10:48.939953+03:00", "deleted_at": null, "department": null, "first_name": "Василий", "is_deleted": false, "updated_at": "2026-03-14T16:10:48.939953+03:00", "middle_name": "Портович", "row_version": 1, "organisation": null, "deleted_by_id": null, "personnel_number": "3302"}	null	2026-03-14 16:10:48.939953+03	2026-03-14 16:10:48.939953+03
9	1	LOGIN	users	1	null	{"id": 1, "role": "admin", "username": "admin", "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:07:42.226939+03:00", "row_version": 3, "deleted_by_id": null, "last_login_at": "2026-03-14T13:24:16.682027"}	{"ip": "127.0.0.1", "ua": "python-httpx/0.28.1"}	2026-03-14 16:24:16.404245+03	2026-03-14 16:24:16.404245+03
10	1	LOGIN	users	1	null	{"id": 1, "role": "admin", "username": "admin", "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:24:16.404245+03:00", "row_version": 4, "deleted_by_id": null, "last_login_at": "2026-03-14T13:24:27.908803"}	{"ip": "127.0.0.1", "ua": "python-httpx/0.28.1"}	2026-03-14 16:24:27.66016+03	2026-03-14 16:24:27.66016+03
11	1	DIRECT_TO_CABINET	equipment_movements	3	null	{"id": 3, "comment": "tx test unique equipment", "quantity": 1, "reference": null, "created_at": "2026-03-14T16:24:43.856356+03:00", "updated_at": "2026-03-14T16:24:43.856356+03:00", "movement_type": "direct_to_cabinet", "to_cabinet_id": 1, "to_assembly_id": null, "from_cabinet_id": null, "performed_by_id": 1, "to_warehouse_id": null, "equipment_type_id": 1, "from_warehouse_id": null}	null	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
12	1	DELETE	cabinet_items	4	{"id": 4, "quantity": 1, "cabinet_id": 1, "created_at": "2026-03-14T15:09:28.819387+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T15:09:37.976007+03:00", "row_version": 3, "deleted_by_id": null, "equipment_type_id": 1}	{"id": 4, "quantity": 1, "cabinet_id": 1, "created_at": "2026-03-14T15:09:28.819387+03:00", "deleted_at": "2026-03-14T13:29:48.429013", "is_deleted": true, "updated_at": "2026-03-14T15:09:37.976007+03:00", "row_version": 3, "deleted_by_id": 1, "equipment_type_id": 1}	null	2026-03-14 16:29:48.435553+03	2026-03-14 16:29:48.435553+03
13	1	UPDATE	io_signals	34	{"id": 34, "tag": null, "signal": null, "is_active": true, "created_at": "2026-03-14T16:24:43.856356+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:24:43.856356+03:00", "row_version": 1, "signal_type": "AI", "channel_index": 1, "deleted_by_id": null, "signal_kind_id": null, "measurement_type": null, "measurement_unit_id": null, "equipment_in_operation_id": 5}	{"id": 34, "tag": "234", "signal": "dfs", "is_active": true, "created_at": "2026-03-14T16:24:43.856356+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:24:43.856356+03:00", "row_version": 1, "signal_type": "AI", "channel_index": 1, "deleted_by_id": null, "signal_kind_id": 8, "measurement_type": "Pt1000 (RTD AI)", "measurement_unit_id": 5, "equipment_in_operation_id": 5}	null	2026-03-14 16:30:39.506514+03	2026-03-14 16:30:39.506514+03
14	2	LOGIN	users	2	null	{"id": 2, "role": "engineer", "username": "eng", "created_at": "2026-03-14T16:08:52.428762+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:08:52.428762+03:00", "row_version": 1, "deleted_by_id": null, "last_login_at": "2026-03-14T14:31:55.899207"}	{"ip": "127.0.0.1", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"}	2026-03-14 17:31:55.594179+03	2026-03-14 17:31:55.594179+03
15	2	LOGOUT	users	2	null	null	null	2026-03-14 18:03:11.131057+03	2026-03-14 18:03:11.131057+03
16	1	LOGIN	users	1	null	{"id": 1, "role": "admin", "username": "admin", "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T16:24:27.660160+03:00", "row_version": 5, "deleted_by_id": null, "last_login_at": "2026-03-14T15:03:14.859857"}	{"ip": "127.0.0.1", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"}	2026-03-14 18:03:14.479574+03	2026-03-14 18:03:14.479574+03
17	1	LOGIN	users	1	null	{"id": 1, "role": "admin", "username": "admin", "created_at": "2026-03-13T22:25:38.647172+03:00", "deleted_at": null, "is_deleted": false, "updated_at": "2026-03-14T18:03:14.479574+03:00", "row_version": 6, "deleted_by_id": null, "last_login_at": "2026-03-15T12:10:21.083545"}	{"ip": "127.0.0.1", "ua": "Python-urllib/3.12"}	2026-03-15 15:10:20.780067+03	2026-03-15 15:10:20.780067+03
\.


--
-- Data for Name: cabinet_files; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.cabinet_files (id, cabinet_id, original_name, stored_name, ext, size_bytes, mime, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, created_by_id) FROM stdin;
\.


--
-- Data for Name: cabinet_items; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.cabinet_items (id, cabinet_id, equipment_type_id, quantity, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	1	1	1	f	\N	\N	3	2026-03-14 15:09:28.819387+03	2026-03-14 15:09:37.976007+03
5	1	1	1	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
4	1	1	1	t	2026-03-14 13:29:48.429013+03	1	4	2026-03-14 15:09:28.819387+03	2026-03-14 16:29:48.435553+03
\.


--
-- Data for Name: cabinets; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.cabinets (id, name, location_id, meta_data, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at, factory_number, nomenclature_number) FROM stdin;
1	ШК1	1	null	f	\N	\N	1	2026-03-14 15:08:42.798382+03	2026-03-14 15:08:42.798382+03	13241	21443234
\.


--
-- Data for Name: data_types; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.data_types (id, name, parent_id, tooltip, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, row_version) FROM stdin;
1	BOOL	\N	1 бит, TRUE / FALSE. Самый распространённый тип: состояние кнопки, концевика, реле.	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
2	Целочисленные	\N	\N	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
3	BYTE	2	8 бит, беззнаковый (0…255)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
4	WORD	2	16 бит, беззнаковый (0…65535)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
5	DWORD	2	32 бита, беззнаковый	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
6	LWORD	2	64 бита, беззнаковый	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
7	SINT	2	8 бит, знаковый (-128…127)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
8	INT	2	16 бит, знаковый (-32768…32767)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
9	DINT	2	32 бита, знаковый. Часто используется для счётчиков, позиций энкодера.	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
10	LINT	2	64 бита, знаковый	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
11	USINT	2	беззнаковая версия INT-типов	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
12	UINT	2	беззнаковая версия INT-типов	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
13	UDINT	2	беззнаковая версия INT-типов	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
14	ULINT	2	беззнаковая версия INT-типов	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
15	Числа с плавающей точкой	\N	\N	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
16	REAL	15	32 бита (IEEE 754). Основной тип для физических величин: температура, давление, расход.	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
17	LREAL	15	64 бита, повышенная точность	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
18	Временны́е	\N	\N	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
19	TIME	18	длительность (например T#5s, T#1h30m)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
20	DATE	18	календарная дата	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
21	TIME_OF_DAY / TOD	18	время суток	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
22	DATE_AND_TIME / DT	18	дата + время	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
23	Строковые	\N	\N	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
24	STRING	23	строка символов (ASCII), длина по умолчанию 80 символов, задаётся как STRING[n]	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
25	WSTRING	23	строка в Unicode (широкие символы)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
26	CHAR	23	один символ	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
27	Производные (пользовательские)	\N	\N	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
28	ARRAY	27	массив однотипных элементов: ARRAY[0..99] OF REAL	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
29	STRUCT	27	структура из разнотипных полей (аналог struct в C), удобно для хранения параметров одного устройства	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
30	ENUM	27	перечисление именованных состояний (например: STOPPED, RUNNING, FAULT)	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
31	FUNCTION_BLOCK	27	функциональный блок со своими входами, выходами и внутренним состоянием	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
\.


--
-- Data for Name: equipment_categories; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.equipment_categories (id, name, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	ПЛК	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
2	Реле	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
3	HMI	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
4	Блок питания	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
5	Преобразователь	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
6	Программируемое реле	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
\.


--
-- Data for Name: equipment_movements; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.equipment_movements (id, movement_type, equipment_type_id, quantity, from_warehouse_id, to_warehouse_id, from_cabinet_id, to_cabinet_id, reference, comment, performed_by_id, created_at, updated_at, to_assembly_id) FROM stdin;
1	direct_to_cabinet	1	1	\N	\N	\N	1	\N	\N	1	2026-03-14 15:09:28.819387+03	2026-03-14 15:09:28.819387+03	\N
2	direct_to_cabinet	1	1	\N	\N	\N	1	\N	\N	1	2026-03-14 15:09:37.976007+03	2026-03-14 15:09:37.976007+03	\N
3	direct_to_cabinet	1	1	\N	\N	\N	1	\N	tx test unique equipment	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03	\N
\.


--
-- Data for Name: equipment_types; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.equipment_types (id, name, nomenclature_number, manufacturer_id, is_channel_forming, channel_count, meta_data, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at, equipment_category_id, ai_count, di_count, ao_count, do_count, is_network, network_ports, article, has_serial_interfaces, serial_ports, photo_filename, photo_mime, datasheet_filename, datasheet_mime, datasheet_original_name) FROM stdin;
1	PLC базовый	PLC-001	1	t	16	{"unit_price_rub": 100000}	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	\N	16	0	0	0	f	\N	\N	f	[]	\N	\N	\N	\N	\N
\.


--
-- Data for Name: field_equipments; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.field_equipments (id, name, parent_id, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, row_version) FROM stdin;
1	Полевое оборудование	\N	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
2	Оборудование КИПиА	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
3	Температура	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
4	Термопары (ТХА, ТХК, ТПП и др.)	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
5	Термометры сопротивления (ТСП, ТСМ, Pt100)	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
6	Пирометры (инфракрасные, оптические)	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
7	Биметаллические и жидкостные термометры	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
8	Давление	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
9	Манометры (показывающие, электроконтактные)	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
10	Мановакуумметры и вакуумметры	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
11	Датчики давления (абсолютного, избыточного, дифференциального)	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
12	Реле давления	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
13	Расход	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
14	Расходомеры переменного перепада давления (диафрагмы, сопла, трубки Вентури)	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
15	Электромагнитные расходомеры	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
16	Вихревые расходомеры	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
17	Ультразвуковые расходомеры	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
18	Кориолисовые расходомеры (массовые)	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
19	Ротаметры	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
20	Счётчики газа, воды, пара	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
21	Уровень	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
22	Поплавковые уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
23	Буйковые уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
24	Гидростатические уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
25	Радарные (микроволновые) уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
26	Ультразвуковые уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
27	Ёмкостные уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
28	Вибрационные и магнитострикционные уровнемеры	21	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
29	Аналитические приборы	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
30	Газоанализаторы (O₂, CO, CO₂, H₂S и др.)	29	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
31	pH-метры и окислительно-восстановительные потенциометры	29	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
32	Кондуктометры	29	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
33	Хроматографы	29	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
34	Анализаторы влажности и точки росы	29	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
35	Турбидиметры (мутность)	29	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
36	Исполнительные механизмы	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
\.


--
-- Data for Name: io_signals; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.io_signals (id, equipment_in_operation_id, signal_type, channel_index, tag, signal, signal_kind_id, measurement_type, measurement_unit_id, is_active, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	1	AI	1	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
2	1	AI	2	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
3	1	AI	3	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
4	1	AI	4	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
5	1	AI	5	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
6	1	AI	6	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
7	1	AI	7	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
8	1	AI	8	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
9	1	AI	9	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
10	1	AI	10	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
11	1	AI	11	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
12	1	AI	12	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
13	1	AI	13	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
14	1	AI	14	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
15	1	AI	15	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
16	1	AI	16	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 15:54:34.051291+03	2026-03-14 15:54:34.051291+03
18	4	AI	1	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
19	4	AI	2	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
20	4	AI	3	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
21	4	AI	4	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
22	4	AI	5	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
23	4	AI	6	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
24	4	AI	7	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
25	4	AI	8	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
26	4	AI	9	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
27	4	AI	10	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
28	4	AI	11	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
29	4	AI	12	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
30	4	AI	13	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
31	4	AI	14	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
32	4	AI	15	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
33	4	AI	16	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:21:39.231546+03	2026-03-14 16:21:39.231546+03
35	5	AI	2	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
36	5	AI	3	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
37	5	AI	4	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
38	5	AI	5	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
39	5	AI	6	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
40	5	AI	7	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
41	5	AI	8	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
42	5	AI	9	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
43	5	AI	10	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
44	5	AI	11	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
45	5	AI	12	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
46	5	AI	13	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
47	5	AI	14	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
48	5	AI	15	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
49	5	AI	16	\N	\N	\N	\N	\N	t	f	\N	\N	1	2026-03-14 16:24:43.856356+03	2026-03-14 16:24:43.856356+03
34	5	AI	1	234	dfs	8	Pt1000 (RTD AI)	5	t	f	\N	\N	2	2026-03-14 16:24:43.856356+03	2026-03-14 16:30:39.506514+03
\.


--
-- Data for Name: io_signals_legacy; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.io_signals_legacy (id, cabinet_component_id, tag_name, signal_name, plc_channel_address, signal_type, measurement_type, terminal_connection, sensor_range, engineering_units, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at, measurement_unit_id) FROM stdin;
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.locations (id, name, parent_id, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	Локация 1	\N	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
\.


--
-- Data for Name: main_equipment; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.main_equipment (id, name, parent_id, level, code, meta_data, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, row_version) FROM stdin;
245	ДРОБЛЕНИЕ	\N	1	1	{"automation_params": "Первичное, вторичное и третичное дробление руды"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
246	ГРОХОЧЕНИЕ	\N	1	2	{"automation_params": "Классификация материала по крупности"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
247	ИЗМЕЛЬЧЕНИЕ	\N	1	3	{"automation_params": "Помол руды до необходимой крупности вскрытия"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
248	КЛАССИФИКАЦИЯ ПУЛЬПЫ	\N	1	4	{"automation_params": "Разделение частиц по крупности в жидкой среде"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
249	ФЛОТАЦИЯ	\N	1	5	{"automation_params": "Избирательное разделение минералов по поверхностным свойствам"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
250	СГУЩЕНИЕ И ОСВЕТЛЕНИЕ	\N	1	6	{"automation_params": "Отделение твёрдой фазы от жидкой"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
251	ФИЛЬТРАЦИЯ И ОБЕЗВОЖИВАНИЕ	\N	1	7	{"automation_params": "Снижение влажности концентрата и хвостов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
252	СУШКА И ПРОКАЛКА	\N	1	8	{"automation_params": "Удаление влаги и термическая обработка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
253	ГИДРОМЕТАЛЛУРГИЯ — ВЫЩЕЛАЧИВАНИЕ	\N	1	9	{"automation_params": "Перевод металлов в раствор"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
254	ГИДРОМЕТАЛЛУРГИЯ — ЭКСТРАКЦИЯ (SX)	\N	1	10	{"automation_params": "Жидкостная экстракция органическими растворителями"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
255	ГИДРОМЕТАЛЛУРГИЯ — ЭЛЕКТРОЛИЗ	\N	1	11	{"automation_params": "Осаждение металла из раствора"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
256	НАСОСЫ	\N	1	12	{"automation_params": "Перекачка пульпы, растворов, реагентов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
257	ЗАПОРНАЯ И РЕГУЛИРУЮЩАЯ АРМАТУРА	\N	1	13	{"automation_params": "Управление потоками пульп, растворов, газов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
258	ПИТАТЕЛИ И ДОЗАТОРЫ	\N	1	14	{"automation_params": "Регулируемая подача руды, концентратов, реагентов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
259	КОНВЕЙЕРЫ И ТРАНСПОРТЁРЫ	\N	1	15	{"automation_params": "Перемещение твёрдых материалов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
260	ХВОСТОВОЕ И ВОДООБОРОТНОЕ ХОЗЯЙСТВО	\N	1	16	{"automation_params": "Складирование хвостов и оборот воды"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
261	ВСПОМОГАТЕЛЬНОЕ ОБОРУДОВАНИЕ	\N	1	17	{"automation_params": "Обслуживание основных процессов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
262	Щёковая дробилка	245	2	1.1	{"automation_params": "Нагрузка на привод, ход щеки, крупность продукта, температура подшипников"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
263	Конусная дробилка	245	2	1.2	null	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
264	Молотковая (роторная) дробилка	245	2	1.3	{"automation_params": "Нагрузка ротора, зазор отбойных плит, виброускорение"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
265	Валковая дробилка	245	2	1.4	{"automation_params": "Зазор между валками, нагрузка, скорость"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
266	Высокого давления мельница (ВДРМ / HPGR)	245	2	1.5	{"automation_params": "Давление на валки, зазор, производительность, нагрузка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
267	Инерционный грохот (вибрационный)	246	2	2.1	{"automation_params": "Амплитуда и частота колебаний, нагрузка привода, вибрация"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
268	Резонансный грохот	246	2	2.2	{"automation_params": "Частота резонанса, амплитуда"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
269	Бурат (барабанный грохот)	246	2	2.3	{"automation_params": "Скорость вращения, нагрузка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
270	Дуговое сито (DSM / дуговое сито)	246	2	2.4	{"automation_params": "Давление пульпы на входе, уровень подачи"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
271	Высокочастотный грохот (Fine Screen)	246	2	2.5	{"automation_params": "Амплитуда, частота, орошение"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
272	Шаровая мельница	247	2	3.1	{"automation_params": "Нагрузка (ток статора), давление на подшипниках, уровень шума, плотность пульпы на выходе"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
273	Стержневая мельница	247	2	3.2	{"automation_params": "Нагрузка, давление масла на подшипниках, расход воды"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
274	Мельница самоизмельчения (МСИ / AG)	247	2	3.3	{"automation_params": "Нагрузка по мощности, вибро-шум (акустика), уровень загрузки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
275	Мельница полусамоизмельчения (МПСИ / SAG)	247	2	3.4	{"automation_params": "Мощность, масса мельницы (load cell), крупность разгрузки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
276	Вертикальная мельница (IsaMill, Vertimill)	247	2	3.5	{"automation_params": "Нагрузка диска/ротора, давление, плотность суспензии"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
277	Вибрационная мельница	247	2	3.6	{"automation_params": "Амплитуда, частота, температура подшипников"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
278	Спиральный классификатор	248	2	4.1	{"automation_params": "Уровень пульпы в ванне, скорость вращения спирали, нагрузка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
279	Гидроциклон	248	2	4.2	{"automation_params": "Давление питания, плотность питания, соотношение слива/пески"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
280	Батарея гидроциклонов	248	2	4.3	{"automation_params": "Давление в коллекторе, количество работающих циклонов, плотность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
281	Классификатор с воздушной сепарацией (воздушный)	248	2	4.4	{"automation_params": "Расход воздуха, скорость ротора, крупность продукта"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
282	Механическая флотомашина	249	2	5.1	{"automation_params": "Уровень пульпы в камере, расход воздуха, скорость импеллера, pH"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
283	Пневматическая флотомашина (колонная)	249	2	5.2	{"automation_params": "Расход воздуха, уровень пены, промывная вода, pH"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
284	Пневмомеханическая флотомашина	249	2	5.3	{"automation_params": "Уровень пульпы, скорость импеллера, расход воздуха"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
285	Флотационная колонна	249	2	5.4	{"automation_params": "Уровень пены, расход воздуха, расход питания, pH"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
286	Реагентное хозяйство (дозирование реагентов)	249	2	5.5	null	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
287	pH-регулятор (известковое молоко)	249	2	5.6	{"automation_params": "pH пульпы, расход известкового молока, плотность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
288	Радиальный сгуститель (Thickener)	250	2	6.1	{"automation_params": "Уровень шламовой постели, момент на гребёнке, мутность слива, плотность разгрузки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
289	Высокопроизводительный сгуститель (HRT / Paste Thickener)	250	2	6.2	{"automation_params": "Плотность и уровень осадка, момент привода гребёнки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
290	Ламельный (тонкослойный) отстойник	250	2	6.3	{"automation_params": "Мутность слива, уровень шлама, расход питания"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
291	Гидроциклон сгущающий	250	2	6.4	{"automation_params": "Давление питания, плотность питания и разгрузки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
292	Флокулянтная станция (система дозирования флокулянта)	250	2	6.5	{"automation_params": "Концентрация флокулянта, расход, точка подачи"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
293	Барабанный вакуум-фильтр	251	2	7.1	{"automation_params": "Разрежение, скорость вращения барабана, влажность осадка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
294	Дисковый вакуум-фильтр	251	2	7.2	{"automation_params": "Разрежение, скорость вращения, толщина корки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
295	Ленточный вакуум-фильтр	251	2	7.3	{"automation_params": "Разрежение, скорость ленты, расход промывной воды"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
296	Фильтр-пресс камерный	251	2	7.4	{"automation_params": "Давление прессования, время цикла, влажность кека"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
297	Гидрофол / Центрифуга осадительная	251	2	7.5	{"automation_params": "Обороты ротора, скорость шнека, нагрузка по моменту"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
298	Пресс-фильтр (Tower Press / Vertical)	251	2	7.6	{"automation_params": "Давление, время фильтрации, количество камер"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
299	Барабанная сушилка	252	2	8.1	{"automation_params": "Температура теплоносителя на входе/выходе, скорость вращения, нагрузка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
300	Вращающаяся трубчатая печь (ВТП / Rotary Kiln)	252	2	8.2	{"automation_params": "Температура по зонам, скорость вращения, разрежение в топке, расход топлива"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
301	Аэрофонтанная сушилка (Flash Dryer)	252	2	8.3	{"automation_params": "Температура воздуха, расход питания, давление"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
302	Распылительная сушилка	252	2	8.4	{"automation_params": "Температура на входе/выходе, давление распыления, расход суспензии"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
303	Печь кипящего слоя (ПКС)	252	2	8.5	{"automation_params": "Температура слоя, давление дутья, уровень слоя"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
304	Чан-реактор выщелачивания с мешалкой (CIL/CIP/CSTR)	253	2	9.1	{"automation_params": "pH, Eh (окислительно-восстановительный потенциал), температура, DO (растворённый кислород), уровень"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
305	Автоклав высокого давления (POX / PAL)	253	2	9.2	{"automation_params": "Давление, температура, расход кислорода/кислоты, pH, уровень пульпы"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
306	Кучное выщелачивание (орошение кучи)	253	2	9.3	{"automation_params": "Расход раствора (оросители), pH, Eh, уровень прудков-накопителей"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
307	Реактор биовыщелачивания (BIOX)	253	2	9.4	{"automation_params": "pH, температура, DO, CO₂, расход питательных веществ"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
308	Бактериальные чаны (Tank Bioleaching)	253	2	9.5	{"automation_params": "pH, температура, DO, аэрация, скорость мешалки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
309	Промывная декантация (CCD)	253	2	9.6	{"automation_params": "Плотность сгущённого продукта, расход промывной воды, мутность слива"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
310	Смеситель-отстойник (Mixer-Settler)	254	2	10.1	{"automation_params": "Скорость перемешивания, соотношение O:A, уровень раздела фаз, температура"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
311	Пульсационная колонна	254	2	10.2	{"automation_params": "Частота и амплитуда пульсации, расход фаз"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
312	Центробежный экстрактор (Podbielniak / CINC)	254	2	10.3	{"automation_params": "Обороты ротора, расход фаз, давление"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
313	Ионообменная колонна (сорбция/десорбция)	254	2	10.4	{"automation_params": "Расход элюента, pH, температура, профиль концентраций"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
314	Электролизёр (ЭВ / Electrowinning cell)	255	2	11.1	{"automation_params": "Ток, напряжение на ванне, температура электролита, расход раствора, уровень"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
315	Выпрямительный агрегат (ТПС / Rectifier)	255	2	11.2	{"automation_params": "Ток нагрузки, напряжение, коэффициент мощности"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
316	Система промывки и съёма катодов	255	2	11.3	{"automation_params": "Цикл съёма, давление промывочной воды, количество циклов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
317	Циркуляционный бак электролита (Head Tank)	255	2	11.4	{"automation_params": "Уровень, температура, плотность, pH электролита"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
318	Центробежный насос для воды/растворов	256	2	12.1	{"automation_params": "Давление на выходе, расход, уровень в приёмном баке"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
319	Пульповый (шламовый) насос центробежный	256	2	12.2	{"automation_params": "Давление, расход, ток привода, плотность пульпы"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
320	Горизонтальный многоступенчатый насос	256	2	12.3	{"automation_params": "Давление, расход, температура подшипников"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
321	Вертикальный насос (sump pump)	256	2	12.4	{"automation_params": "Уровень в зумпфе (автопуск/останов), давление"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
322	Диафрагменный насос (перистальтический)	256	2	12.5	{"automation_params": "Расход реагентов, давление, счёт ходов"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
323	Поршневой (плунжерный) насос высокого давления	256	2	12.6	{"automation_params": "Давление нагнетания, расход, температура сальника"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
324	Насос-дозатор (мембранный/плунжерный)	256	2	12.7	{"automation_params": "Объёмный расход, давление, цикл дозирования"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
325	Эрлифт (пневматический подъём пульпы)	256	2	12.8	{"automation_params": "Расход сжатого воздуха, давление, производительность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
326	По конструкции	257	2	13.1	null	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
327	По типу привода	257	2	13.2	null	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
328	Пластинчатый питатель (апрон)	258	2	14.1	{"automation_params": "Скорость ленты, нагрузка привода, взвешивание (конвейерные весы)"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
329	Вибрационный питатель	258	2	14.2	{"automation_params": "Амплитуда, частота, производительность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
330	Лотковый питатель с переменным ходом	258	2	14.3	{"automation_params": "Ход лотка, частота, производительность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
331	Шнековый дозатор (volumetric / gravimetric)	258	2	14.4	{"automation_params": "Скорость шнека, масса (тензодатчик), заданный расход"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
332	Ленточный дозатор (конвейерные весы)	258	2	14.5	{"automation_params": "Скорость ленты, нагрузка на ленту, интегральная масса"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
333	Бункерные весы (loss-in-weight / batch)	258	2	14.6	{"automation_params": "Масса в бункере, скорость выдачи, цикл дозирования"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
334	Дисковый питатель	258	2	14.7	{"automation_params": "Скорость диска, производительность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
335	Насос-дозатор жидких реагентов	258	2	14.8	{"automation_params": "Расход, давление, суммарный объём"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
336	Ленточный конвейер	259	2	15.1	{"automation_params": "Скорость ленты, натяжение, нагрузка (конвейерные весы), сход ленты"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
337	Пластинчатый конвейер (апрон)	259	2	15.2	{"automation_params": "Скорость, нагрузка привода, аварийный сдвиг"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
338	Шнековый конвейер	259	2	15.3	{"automation_params": "Нагрузка привода, забивка шнека, уровень в желобе"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
339	Скребковый конвейер	259	2	15.4	{"automation_params": "Нагрузка цепи, скорость, аварийный срыв цепи"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
340	Ковшовый элеватор (нория)	259	2	15.5	{"automation_params": "Нагрузка привода, сход ленты/цепи, уровень на дне"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
341	Пневмотранспорт (трубопроводный)	259	2	15.6	{"automation_params": "Давление воздуха, расход, засорение трубы (перепад давления)"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
342	Сгуститель хвостов (Tailings Thickener)	260	2	16.1	{"automation_params": "Плотность разгрузки, момент гребёнки, уровень осадка"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
343	Насосная станция хвостопровода	260	2	16.2	{"automation_params": "Давление, расход пульпы, плотность, уровень в зумпфе"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
344	Насосная станция оборотной воды	260	2	16.3	{"automation_params": "Давление в сети, уровень в прудке, расход"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
345	Прудок-отстойник (накопитель)	260	2	16.4	{"automation_params": "Уровень воды, мутность перелива, осадки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
346	Дренажный насос (зумпфовый)	260	2	16.5	{"automation_params": "Уровень в зумпфе (автопуск/останов)"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
347	Система оборотного водоснабжения (трубопровод)	260	2	16.6	{"automation_params": "Давление в кольце, расход, температура"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
348	Компрессорная станция (воздух КИП и автоматики)	261	2	17.1	{"automation_params": "Давление воздуха в ресивере, влажность, производительность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
349	Маслостанция (гидростанция)	261	2	17.2	{"automation_params": "Давление масла, температура, уровень в баке, загрязнённость"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
350	Ёмкость (бак, зумпф, чан)	261	2	17.3	{"automation_params": "Уровень, давление, температура, плотность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
351	Весы автомобильные / железнодорожные	261	2	17.4	{"automation_params": "Масса транспортного средства, цикл взвешивания"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
352	Пробоотборник (автоматический)	261	2	17.5	{"automation_params": "Цикл отбора, масса пробы, условие запуска"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
353	Трубопроводный смеситель (статический / инжекционный)	261	2	17.6	{"automation_params": "Расход компонентов, соотношение, pH на выходе"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
354	Вентилятор / Дымосос (технологический)	261	2	17.7	{"automation_params": "Давление тяги, расход воздуха, вибрация"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
355	Вакуум-насос (для фильтров)	261	2	17.8	{"automation_params": "Остаточное давление, нагрузка двигателя, температура"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
356	ККД (крупного дробления)	263	3	1.2.1	{"automation_params": "Уровень руды в приёмной воронке, нагрузка привода, вибрация"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
357	КСД (среднего дробления)	263	3	1.2.2	{"automation_params": "Ширина разгрузочной щели (CSS), нагрузка, давление масла"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
358	КМД (мелкого дробления)	263	3	1.2.3	{"automation_params": "CSS, нагрузка, давление гидроопоры, вибрация"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
359	Бак-мешалка (кондиционер реагентов)	286	3	5.5.1	{"automation_params": "Скорость мешалки, уровень, температура"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
360	Дозатор реагентов (насос-дозатор)	286	3	5.5.2	{"automation_params": "Объёмный расход, давление, время цикла"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
361	Расходный бак с подачей самотёком	286	3	5.5.3	{"automation_params": "Уровень в баке, расход через ротаметр/расходомер"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
362	Шаровой кран	326	3	13.1.1	{"automation_params": "Быстрое открытие/закрытие — On/Off"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
363	Шиберная задвижка (пульповая)	326	3	13.1.2	{"automation_params": "Полное перекрытие, абразивные среды"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
364	Дисковый затвор (баттерфляй)	326	3	13.1.3	{"automation_params": "Регулирование потока, компактность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
365	Регулирующий клапан (седельный / cage)	326	3	13.1.4	{"automation_params": "Плавное регулирование расхода"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
366	Пинч-клапан (шланговый)	326	3	13.1.5	{"automation_params": "Абразивные пульпы — минимальный износ"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
367	Обратный клапан	326	3	13.1.6	{"automation_params": "Защита насоса от обратного тока"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
368	Предохранительный клапан	326	3	13.1.7	{"automation_params": "Сброс давления при превышении уставки"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
369	Ручной привод (маховик/редуктор)	327	3	13.2.1	{"automation_params": "Без автоматизации"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
370	Электрический привод (МЭО/МЭП)	327	3	13.2.2	{"automation_params": "Управление 4-20мА, On/Off, Modbus"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
371	Пневматический привод + электропневмопозиционер	327	3	13.2.3	{"automation_params": "Быстродействие, взрывобезопасность"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
372	Гидравлический привод	327	3	13.2.4	{"automation_params": "Высокое усилие для крупной арматуры"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
373	Соленоидный (электромагнитный)	327	3	13.2.5	{"automation_params": "On/Off, 24VDC/220VAC, быстрое срабатывание"}	2026-03-15 15:10:06.265337+03	2026-03-15 15:10:06.265337+03	f	\N	\N	1
\.


--
-- Data for Name: manufacturers; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.manufacturers (id, name, country, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	Siemens	Germany	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
\.


--
-- Data for Name: measurement_units; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.measurement_units (id, name, parent_id, sort_order, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, row_version) FROM stdin;
1	Температура	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
2	Кельвин (K)	1	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
3	градус Цельсия (°C)	1	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
4	градус Фаренгейта (°F)	1	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
5	градус Ренкина (°R)	1	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
6	Уровень	\N	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
7	Метр (м)	6	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
8	миллиметр (мм)	6	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
9	процент (%)	6	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
10	дюйм (in)	6	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
11	фут (ft)	6	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
12	Расход	\N	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
13	м3/ч	12	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
14	л/мин	12	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
15	л/с	12	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
16	кг/ч	12	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
17	т/сут	12	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
18	Нм3/ч (нормальный)	12	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
19	См3/ч (стандартный)	12	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
20	SCFM	12	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
21	GPM	12	9	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
22	Давление	\N	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
23	Паскаль (Па)	22	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
24	кПа	22	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
25	МПа	22	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
26	бар	22	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
27	кгс/см2	22	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
28	мм рт. ст.	22	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
29	мм вод. ст.	22	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
30	psi (psia, psig, psid)	22	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
31	Торр	22	9	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
32	мбар	22	10	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
33	Плотность	\N	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
34	кг/м3	33	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
35	г/см3	33	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
36	градус API	33	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
37	градус Брикса (°Bx)	33	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
38	градус Плато (°P)	33	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
39	градус Боме (°Be)	33	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
40	градус Эксле (°Oe)	33	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
41	градус Баллинга	33	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
42	pH/ОВП/Оксиметрия	\N	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
43	ед. pH	42	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
44	милливольт (мВ)	42	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
45	мг/л	42	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
46	мкг/л	42	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
47	% насыщения	42	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
48	Электропараметры	\N	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
49	Ампер (А)	48	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
50	мА	48	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
51	Вольт (В)	48	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
52	мВ	48	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
53	Ватт (Вт)	48	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
54	кВтч	48	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
55	мкСм/см	48	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
56	мСм/см	48	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
57	Омсм	48	9	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
58	МОм*см	48	10	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
59	ppm (TDS)	48	11	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
60	Вибрация	\N	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
61	мкм	60	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
62	mils	60	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
63	мм/с (RMS/Peak)	60	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
64	ips	60	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
65	м/с2	60	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
66	g	60	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
67	дБ	60	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
68	Гц	60	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
69	Концентрация газов	\N	9	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
70	% Vol	69	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
71	ppm	69	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
72	ppb	69	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
73	% LEL (НКПР)	69	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
74	мг/м3	69	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
75	мкг/м3	69	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
76	Энкодеры	\N	10	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
77	имп/об (PPR)	76	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
78	отсчетов (CPR)	76	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
79	бит (bit)	76	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
80	мкм	76	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
81	LPI	76	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
82	DPI	76	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
83	угловые секунды	76	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
84	градусы	76	8	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
85	Свет	\N	11	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
86	Кандела (кд)	85	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
87	Люмен (лм)	85	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
88	Люкс (лк)	85	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
89	foot-candle (fc)	85	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
90	кд/м2 (нит)	85	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
91	мкВт/см2	85	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
92	Влажность	\N	12	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
93	% RH (относительная)	92	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
94	°C Td (точка росы)	92	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
95	г/м3	92	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
96	г/кг	92	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
97	ppmV	92	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
98	Масса и вес	\N	13	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
99	кг	98	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
100	т	98	2	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
101	фунт (lb)	98	3	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
102	Ньютон (Н)	98	4	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
103	кН	98	5	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
104	мВ/В (РКП)	98	6	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
105	деления (e, d)	98	7	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03	f	\N	\N	1
\.


--
-- Data for Name: personnel; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.personnel (id, user_id, first_name, last_name, middle_name, "position", personnel_number, service, shop, department, division, birth_date, hire_date, organisation, email, phone, notes, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	\N	Иван	Иванов	\N	Инженер	\N	\N	\N	АСУ	\N	\N	\N	EQM Demo	\N	\N	\N	f	\N	\N	1	2026-03-13 22:25:39.275212+03	2026-03-13 22:25:39.275212+03
2	2	Василий	Админский	Портович	Админ	3302	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	1	2026-03-14 16:10:48.939953+03	2026-03-14 16:10:48.939953+03
\.


--
-- Data for Name: personnel_competencies; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.personnel_competencies (id, personnel_id, name, organisation, city, completion_date, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: personnel_trainings; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.personnel_trainings (id, personnel_id, name, completion_date, next_due_date, reminder_offset_days, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pid_processes; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.pid_processes (id, location_id, name, description, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, row_version) FROM stdin;
\.


--
-- Data for Name: signal_types; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.signal_types (id, name, parent_id, sort_order, created_at, updated_at, is_deleted, deleted_at, deleted_by_id, row_version) FROM stdin;
1	AI	\N	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
2	AO	\N	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
3	DI	\N	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
4	DO	\N	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
5	4-20mA	1	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
6	0-20mA	1	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
7	0-10V	1	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
8	Pt100	1	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
9	Pt1000	1	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
10	M50	1	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
11	4-20mA	2	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
12	0-20mA	2	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
13	0-10V	2	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
14	24V	3	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
15	220V	3	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
16	8-16mA	3	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
17	24V	4	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
18	220V	4	\N	2026-03-13 22:25:23.785607+03	2026-03-13 22:25:23.785607+03	f	\N	\N	1
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.user_sessions (id, user_id, session_token_hash, started_at, ended_at, end_reason, ip_address, user_agent, created_at, updated_at) FROM stdin;
1	1	5f62f0f9953f6a7de611c63bb1b49e7c02e6c3ad7931cd87ee95ab9f2a521d58	2026-03-14 15:06:59.042785+03	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-14 15:06:59.042785+03	2026-03-14 15:06:59.042785+03
2	1	cbc8b67fd583bb4d268103e800852e66eb21ea0b62b7cdb81cd9350a72a05b82	2026-03-14 16:07:42.226939+03	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-14 16:07:42.226939+03	2026-03-14 16:07:42.226939+03
3	1	bdf0d6f848a708fa8b32c02ba7b1baea784e5a8c9df6ddf0ac3254dfc12a0158	2026-03-14 16:24:16.404245+03	\N	\N	127.0.0.1	python-httpx/0.28.1	2026-03-14 16:24:16.404245+03	2026-03-14 16:24:16.404245+03
4	1	c2d6cd28d9e2bebff15610ff5de168d3e2814160d569cdd061fb989037f965c4	2026-03-14 16:24:27.66016+03	\N	\N	127.0.0.1	python-httpx/0.28.1	2026-03-14 16:24:27.66016+03	2026-03-14 16:24:27.66016+03
5	2	5f7b08507864b87828dcf86702b9b2efed234c6ca2efb7e9042d1fe329395e9d	2026-03-14 17:31:55.594179+03	2026-03-14 15:03:11.134747+03	logout	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-14 17:31:55.594179+03	2026-03-14 18:03:11.131057+03
6	1	0ae949a3cf4101f60534bd4cb5da1374d8fedc423943827fa2cae6e4100ae664	2026-03-14 18:03:14.479574+03	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	2026-03-14 18:03:14.479574+03	2026-03-14 18:03:14.479574+03
7	1	cf2855c0806ff3d2c73017ffa60f9159c670ee601d8c12d544dd00cac32be9aa	2026-03-15 15:10:20.780067+03	\N	\N	127.0.0.1	Python-urllib/3.12	2026-03-15 15:10:20.780067+03	2026-03-15 15:10:20.780067+03
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.users (id, username, password_hash, role, last_login_at, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
2	eng	$2b$12$MzqrY19/dIO1sUIr5kON2OqY/MLRSb05/F.Ov8vlOVtAjji9oOSvS	engineer	2026-03-14 14:31:55.899207+03	f	\N	\N	2	2026-03-14 16:08:52.428762+03	2026-03-14 17:31:55.594179+03
1	admin	$2b$12$/z6kiYOXUvh.7ZwAS/FjKOCHU09M1Uo.Wr45pqmOTO7iqE.FGdQim	admin	2026-03-15 12:10:21.083545+03	f	\N	\N	7	2026-03-13 22:25:38.647172+03	2026-03-15 15:10:20.780067+03
\.


--
-- Data for Name: warehouse_items; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.warehouse_items (id, warehouse_id, equipment_type_id, quantity, last_updated, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at, is_accounted) FROM stdin;
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: equipment_user
--

COPY public.warehouses (id, name, location_id, meta_data, is_deleted, deleted_at, deleted_by_id, row_version, created_at, updated_at) FROM stdin;
1	Склад 1	\N	\N	f	\N	\N	1	2026-03-13 22:25:38.647172+03	2026-03-13 22:25:38.647172+03
\.


--
-- Name: assemblies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.assemblies_id_seq', 1, true);


--
-- Name: assembly_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.assembly_items_id_seq', 2, true);


--
-- Name: attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.attachments_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 17, true);


--
-- Name: cabinet_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.cabinet_files_id_seq', 1, false);


--
-- Name: cabinet_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.cabinet_items_id_seq', 5, true);


--
-- Name: cabinets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.cabinets_id_seq', 1, true);


--
-- Name: data_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.data_types_id_seq', 31, true);


--
-- Name: equipment_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.equipment_categories_id_seq', 6, true);


--
-- Name: equipment_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.equipment_movements_id_seq', 3, true);


--
-- Name: equipment_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.equipment_types_id_seq', 1, true);


--
-- Name: field_equipments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.field_equipments_id_seq', 36, true);


--
-- Name: io_signals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.io_signals_id_seq', 1, false);


--
-- Name: io_signals_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.io_signals_id_seq1', 49, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.locations_id_seq', 1, true);


--
-- Name: main_equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.main_equipment_id_seq', 373, true);


--
-- Name: manufacturers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.manufacturers_id_seq', 1, true);


--
-- Name: measurement_units_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.measurement_units_id_seq', 105, true);


--
-- Name: personnel_competencies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.personnel_competencies_id_seq', 1, false);


--
-- Name: personnel_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.personnel_id_seq', 2, true);


--
-- Name: personnel_trainings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.personnel_trainings_id_seq', 1, false);


--
-- Name: pid_processes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.pid_processes_id_seq', 1, false);


--
-- Name: signal_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.signal_types_id_seq', 18, true);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 7, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: warehouse_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.warehouse_items_id_seq', 1, false);


--
-- Name: warehouses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: equipment_user
--

SELECT pg_catalog.setval('public.warehouses_id_seq', 1, true);


--
-- Name: alembic_version alembic_version_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkey PRIMARY KEY (version_num);


--
-- Name: assemblies assemblies_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assemblies
    ADD CONSTRAINT assemblies_pkey PRIMARY KEY (id);


--
-- Name: assembly_items assembly_items_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assembly_items
    ADD CONSTRAINT assembly_items_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cabinet_files cabinet_files_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_files
    ADD CONSTRAINT cabinet_files_pkey PRIMARY KEY (id);


--
-- Name: cabinet_items cabinet_items_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_items
    ADD CONSTRAINT cabinet_items_pkey PRIMARY KEY (id);


--
-- Name: cabinets cabinets_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinets
    ADD CONSTRAINT cabinets_pkey PRIMARY KEY (id);


--
-- Name: data_types data_types_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.data_types
    ADD CONSTRAINT data_types_pkey PRIMARY KEY (id);


--
-- Name: equipment_categories equipment_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_categories
    ADD CONSTRAINT equipment_categories_pkey PRIMARY KEY (id);


--
-- Name: equipment_movements equipment_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_pkey PRIMARY KEY (id);


--
-- Name: equipment_types equipment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_types
    ADD CONSTRAINT equipment_types_pkey PRIMARY KEY (id);


--
-- Name: field_equipments field_equipments_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.field_equipments
    ADD CONSTRAINT field_equipments_pkey PRIMARY KEY (id);


--
-- Name: io_signals_legacy io_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals_legacy
    ADD CONSTRAINT io_signals_pkey PRIMARY KEY (id);


--
-- Name: io_signals io_signals_pkey1; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals
    ADD CONSTRAINT io_signals_pkey1 PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: main_equipment main_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.main_equipment
    ADD CONSTRAINT main_equipment_pkey PRIMARY KEY (id);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- Name: measurement_units measurement_units_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.measurement_units
    ADD CONSTRAINT measurement_units_pkey PRIMARY KEY (id);


--
-- Name: personnel_competencies personnel_competencies_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_competencies
    ADD CONSTRAINT personnel_competencies_pkey PRIMARY KEY (id);


--
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (id);


--
-- Name: personnel_trainings personnel_trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_trainings
    ADD CONSTRAINT personnel_trainings_pkey PRIMARY KEY (id);


--
-- Name: pid_processes pid_processes_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.pid_processes
    ADD CONSTRAINT pid_processes_pkey PRIMARY KEY (id);


--
-- Name: signal_types signal_types_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.signal_types
    ADD CONSTRAINT signal_types_pkey PRIMARY KEY (id);


--
-- Name: io_signals uq_io_signals_eio_type_channel; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals
    ADD CONSTRAINT uq_io_signals_eio_type_channel UNIQUE (equipment_in_operation_id, signal_type, channel_index);


--
-- Name: warehouse_items uq_warehouse_items_wh_eqtype; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouse_items
    ADD CONSTRAINT uq_warehouse_items_wh_eqtype UNIQUE (warehouse_id, equipment_type_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: warehouse_items warehouse_items_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouse_items
    ADD CONSTRAINT warehouse_items_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: ix_assemblies_location_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_assemblies_location_id ON public.assemblies USING btree (location_id);


--
-- Name: ix_assemblies_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_assemblies_name_active_unique ON public.assemblies USING btree (name) WHERE (is_deleted = false);


--
-- Name: ix_assembly_items_assembly_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_assembly_items_assembly_id ON public.assembly_items USING btree (assembly_id);


--
-- Name: ix_assembly_items_equipment_type_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_assembly_items_equipment_type_id ON public.assembly_items USING btree (equipment_type_id);


--
-- Name: ix_attachments_entity; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_attachments_entity ON public.attachments USING btree (entity);


--
-- Name: ix_attachments_entity_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_attachments_entity_id ON public.attachments USING btree (entity_id);


--
-- Name: ix_attachments_uploaded_by_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_attachments_uploaded_by_id ON public.attachments USING btree (uploaded_by_id);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: ix_audit_logs_entity; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_audit_logs_entity ON public.audit_logs USING btree (entity);


--
-- Name: ix_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_audit_logs_entity_id ON public.audit_logs USING btree (entity_id);


--
-- Name: ix_cabinet_files_cabinet_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_cabinet_files_cabinet_id ON public.cabinet_files USING btree (cabinet_id);


--
-- Name: ix_cabinet_files_created_by_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_cabinet_files_created_by_id ON public.cabinet_files USING btree (created_by_id);


--
-- Name: ix_cabinet_files_is_deleted; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_cabinet_files_is_deleted ON public.cabinet_files USING btree (is_deleted);


--
-- Name: ix_cabinet_items_cabinet_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_cabinet_items_cabinet_id ON public.cabinet_items USING btree (cabinet_id);


--
-- Name: ix_cabinet_items_equipment_type_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_cabinet_items_equipment_type_id ON public.cabinet_items USING btree (equipment_type_id);


--
-- Name: ix_cabinets_location_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_cabinets_location_id ON public.cabinets USING btree (location_id);


--
-- Name: ix_data_types_parent_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_data_types_parent_id ON public.data_types USING btree (parent_id);


--
-- Name: ix_data_types_parent_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_data_types_parent_name_active_unique ON public.data_types USING btree (parent_id, name) WHERE (is_deleted = false);


--
-- Name: ix_equipment_categories_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_equipment_categories_name_active_unique ON public.equipment_categories USING btree (name) WHERE (is_deleted = false);


--
-- Name: ix_equipment_movements_equipment_type_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_equipment_type_id ON public.equipment_movements USING btree (equipment_type_id);


--
-- Name: ix_equipment_movements_from_cabinet_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_from_cabinet_id ON public.equipment_movements USING btree (from_cabinet_id);


--
-- Name: ix_equipment_movements_from_warehouse_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_from_warehouse_id ON public.equipment_movements USING btree (from_warehouse_id);


--
-- Name: ix_equipment_movements_movement_type; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_movement_type ON public.equipment_movements USING btree (movement_type);


--
-- Name: ix_equipment_movements_performed_by_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_performed_by_id ON public.equipment_movements USING btree (performed_by_id);


--
-- Name: ix_equipment_movements_to_assembly_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_to_assembly_id ON public.equipment_movements USING btree (to_assembly_id);


--
-- Name: ix_equipment_movements_to_cabinet_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_to_cabinet_id ON public.equipment_movements USING btree (to_cabinet_id);


--
-- Name: ix_equipment_movements_to_warehouse_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_movements_to_warehouse_id ON public.equipment_movements USING btree (to_warehouse_id);


--
-- Name: ix_equipment_types_equipment_category_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_types_equipment_category_id ON public.equipment_types USING btree (equipment_category_id);


--
-- Name: ix_equipment_types_manufacturer_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_equipment_types_manufacturer_id ON public.equipment_types USING btree (manufacturer_id);


--
-- Name: ix_equipment_types_nomenclature_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_equipment_types_nomenclature_active_unique ON public.equipment_types USING btree (nomenclature_number) WHERE (is_deleted = false);


--
-- Name: ix_field_equipments_parent_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_field_equipments_parent_id ON public.field_equipments USING btree (parent_id);


--
-- Name: ix_field_equipments_parent_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_field_equipments_parent_name_active_unique ON public.field_equipments USING btree (parent_id, name) WHERE (is_deleted = false);


--
-- Name: ix_io_signals_equipment_in_operation_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_io_signals_equipment_in_operation_id ON public.io_signals USING btree (equipment_in_operation_id);


--
-- Name: ix_io_signals_equipment_in_operation_type; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_io_signals_equipment_in_operation_type ON public.io_signals USING btree (equipment_in_operation_id, signal_type);


--
-- Name: ix_io_signals_legacy_cabinet_component_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_io_signals_legacy_cabinet_component_id ON public.io_signals_legacy USING btree (cabinet_component_id);


--
-- Name: ix_io_signals_measurement_unit_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_io_signals_measurement_unit_id ON public.io_signals_legacy USING btree (measurement_unit_id);


--
-- Name: ix_locations_parent_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_locations_parent_id ON public.locations USING btree (parent_id);


--
-- Name: ix_main_equipment_code_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_main_equipment_code_active_unique ON public.main_equipment USING btree (code) WHERE (is_deleted = false);


--
-- Name: ix_main_equipment_parent_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_main_equipment_parent_id ON public.main_equipment USING btree (parent_id);


--
-- Name: ix_manufacturers_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_manufacturers_name_active_unique ON public.manufacturers USING btree (name) WHERE (is_deleted = false);


--
-- Name: ix_measurement_units_parent_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_measurement_units_parent_id ON public.measurement_units USING btree (parent_id);


--
-- Name: ix_measurement_units_parent_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_measurement_units_parent_name_active_unique ON public.measurement_units USING btree (parent_id, name) WHERE (is_deleted = false);


--
-- Name: ix_personnel_competencies_personnel_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_personnel_competencies_personnel_id ON public.personnel_competencies USING btree (personnel_id);


--
-- Name: ix_personnel_personnel_number_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_personnel_personnel_number_active_unique ON public.personnel USING btree (personnel_number) WHERE (is_deleted = false);


--
-- Name: ix_personnel_trainings_next_due_date; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_personnel_trainings_next_due_date ON public.personnel_trainings USING btree (next_due_date);


--
-- Name: ix_personnel_trainings_personnel_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_personnel_trainings_personnel_id ON public.personnel_trainings USING btree (personnel_id);


--
-- Name: ix_personnel_user_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_personnel_user_id ON public.personnel USING btree (user_id);


--
-- Name: ix_pid_processes_location_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_pid_processes_location_id ON public.pid_processes USING btree (location_id);


--
-- Name: ix_pid_processes_location_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_pid_processes_location_name_active_unique ON public.pid_processes USING btree (location_id, name) WHERE (is_deleted = false);


--
-- Name: ix_signal_types_parent_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_signal_types_parent_id ON public.signal_types USING btree (parent_id);


--
-- Name: ix_signal_types_parent_name_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_signal_types_parent_name_active_unique ON public.signal_types USING btree (parent_id, name) WHERE (is_deleted = false);


--
-- Name: ix_user_sessions_session_token_hash; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_user_sessions_session_token_hash ON public.user_sessions USING btree (session_token_hash);


--
-- Name: ix_user_sessions_user_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: ix_users_role; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_users_role ON public.users USING btree (role);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: ix_users_username_active_unique; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE UNIQUE INDEX ix_users_username_active_unique ON public.users USING btree (username) WHERE (is_deleted = false);


--
-- Name: ix_warehouse_items_equipment_type_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_warehouse_items_equipment_type_id ON public.warehouse_items USING btree (equipment_type_id);


--
-- Name: ix_warehouse_items_warehouse_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_warehouse_items_warehouse_id ON public.warehouse_items USING btree (warehouse_id);


--
-- Name: ix_warehouses_location_id; Type: INDEX; Schema: public; Owner: equipment_user
--

CREATE INDEX ix_warehouses_location_id ON public.warehouses USING btree (location_id);


--
-- Name: assemblies assemblies_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assemblies
    ADD CONSTRAINT assemblies_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: assemblies assemblies_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assemblies
    ADD CONSTRAINT assemblies_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: assembly_items assembly_items_assembly_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assembly_items
    ADD CONSTRAINT assembly_items_assembly_id_fkey FOREIGN KEY (assembly_id) REFERENCES public.assemblies(id);


--
-- Name: assembly_items assembly_items_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assembly_items
    ADD CONSTRAINT assembly_items_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: assembly_items assembly_items_equipment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.assembly_items
    ADD CONSTRAINT assembly_items_equipment_type_id_fkey FOREIGN KEY (equipment_type_id) REFERENCES public.equipment_types(id);


--
-- Name: attachments attachments_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: cabinet_files cabinet_files_cabinet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_files
    ADD CONSTRAINT cabinet_files_cabinet_id_fkey FOREIGN KEY (cabinet_id) REFERENCES public.cabinets(id) ON DELETE CASCADE;


--
-- Name: cabinet_files cabinet_files_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_files
    ADD CONSTRAINT cabinet_files_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: cabinet_files cabinet_files_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_files
    ADD CONSTRAINT cabinet_files_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: cabinet_items cabinet_items_cabinet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_items
    ADD CONSTRAINT cabinet_items_cabinet_id_fkey FOREIGN KEY (cabinet_id) REFERENCES public.cabinets(id);


--
-- Name: cabinet_items cabinet_items_equipment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_items
    ADD CONSTRAINT cabinet_items_equipment_type_id_fkey FOREIGN KEY (equipment_type_id) REFERENCES public.equipment_types(id);


--
-- Name: cabinets cabinets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinets
    ADD CONSTRAINT cabinets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: data_types data_types_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.data_types
    ADD CONSTRAINT data_types_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: data_types data_types_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.data_types
    ADD CONSTRAINT data_types_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.data_types(id) ON DELETE SET NULL;


--
-- Name: equipment_movements equipment_movements_equipment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_equipment_type_id_fkey FOREIGN KEY (equipment_type_id) REFERENCES public.equipment_types(id);


--
-- Name: equipment_movements equipment_movements_from_cabinet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_from_cabinet_id_fkey FOREIGN KEY (from_cabinet_id) REFERENCES public.cabinets(id);


--
-- Name: equipment_movements equipment_movements_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: equipment_movements equipment_movements_performed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_performed_by_id_fkey FOREIGN KEY (performed_by_id) REFERENCES public.users(id);


--
-- Name: equipment_movements equipment_movements_to_cabinet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_to_cabinet_id_fkey FOREIGN KEY (to_cabinet_id) REFERENCES public.cabinets(id);


--
-- Name: equipment_movements equipment_movements_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT equipment_movements_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: equipment_types equipment_types_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_types
    ADD CONSTRAINT equipment_types_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- Name: field_equipments field_equipments_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.field_equipments
    ADD CONSTRAINT field_equipments_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: field_equipments field_equipments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.field_equipments
    ADD CONSTRAINT field_equipments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.field_equipments(id) ON DELETE SET NULL;


--
-- Name: attachments fk_attachments_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT fk_attachments_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: cabinet_items fk_cabinet_items_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinet_items
    ADD CONSTRAINT fk_cabinet_items_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: cabinets fk_cabinets_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.cabinets
    ADD CONSTRAINT fk_cabinets_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: equipment_categories fk_equipment_categories_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_categories
    ADD CONSTRAINT fk_equipment_categories_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: equipment_movements fk_equipment_movements_to_assembly_id_assemblies; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_movements
    ADD CONSTRAINT fk_equipment_movements_to_assembly_id_assemblies FOREIGN KEY (to_assembly_id) REFERENCES public.assemblies(id);


--
-- Name: equipment_types fk_equipment_types_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_types
    ADD CONSTRAINT fk_equipment_types_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: equipment_types fk_equipment_types_equipment_category_id; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.equipment_types
    ADD CONSTRAINT fk_equipment_types_equipment_category_id FOREIGN KEY (equipment_category_id) REFERENCES public.equipment_categories(id);


--
-- Name: io_signals_legacy fk_io_signals_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals_legacy
    ADD CONSTRAINT fk_io_signals_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: io_signals_legacy fk_io_signals_measurement_unit_id_measurement_units; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals_legacy
    ADD CONSTRAINT fk_io_signals_measurement_unit_id_measurement_units FOREIGN KEY (measurement_unit_id) REFERENCES public.measurement_units(id) ON DELETE SET NULL;


--
-- Name: locations fk_locations_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT fk_locations_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: manufacturers fk_manufacturers_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT fk_manufacturers_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: users fk_users_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: warehouse_items fk_warehouse_items_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouse_items
    ADD CONSTRAINT fk_warehouse_items_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: warehouses fk_warehouses_deleted_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT fk_warehouses_deleted_by_id_users FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: io_signals_legacy io_signals_cabinet_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals_legacy
    ADD CONSTRAINT io_signals_cabinet_component_id_fkey FOREIGN KEY (cabinet_component_id) REFERENCES public.cabinet_items(id);


--
-- Name: io_signals io_signals_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals
    ADD CONSTRAINT io_signals_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: io_signals io_signals_equipment_in_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals
    ADD CONSTRAINT io_signals_equipment_in_operation_id_fkey FOREIGN KEY (equipment_in_operation_id) REFERENCES public.cabinet_items(id);


--
-- Name: io_signals io_signals_measurement_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals
    ADD CONSTRAINT io_signals_measurement_unit_id_fkey FOREIGN KEY (measurement_unit_id) REFERENCES public.measurement_units(id) ON DELETE SET NULL;


--
-- Name: io_signals io_signals_signal_kind_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.io_signals
    ADD CONSTRAINT io_signals_signal_kind_id_fkey FOREIGN KEY (signal_kind_id) REFERENCES public.signal_types(id) ON DELETE SET NULL;


--
-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: main_equipment main_equipment_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.main_equipment
    ADD CONSTRAINT main_equipment_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: main_equipment main_equipment_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.main_equipment
    ADD CONSTRAINT main_equipment_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.main_equipment(id) ON DELETE SET NULL;


--
-- Name: measurement_units measurement_units_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.measurement_units
    ADD CONSTRAINT measurement_units_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: measurement_units measurement_units_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.measurement_units
    ADD CONSTRAINT measurement_units_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.measurement_units(id) ON DELETE SET NULL;


--
-- Name: personnel_competencies personnel_competencies_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_competencies
    ADD CONSTRAINT personnel_competencies_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: personnel_competencies personnel_competencies_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_competencies
    ADD CONSTRAINT personnel_competencies_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: personnel personnel_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: personnel_trainings personnel_trainings_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_trainings
    ADD CONSTRAINT personnel_trainings_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: personnel_trainings personnel_trainings_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel_trainings
    ADD CONSTRAINT personnel_trainings_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: personnel personnel_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: pid_processes pid_processes_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.pid_processes
    ADD CONSTRAINT pid_processes_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: pid_processes pid_processes_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.pid_processes
    ADD CONSTRAINT pid_processes_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: signal_types signal_types_deleted_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.signal_types
    ADD CONSTRAINT signal_types_deleted_by_id_fkey FOREIGN KEY (deleted_by_id) REFERENCES public.users(id);


--
-- Name: signal_types signal_types_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.signal_types
    ADD CONSTRAINT signal_types_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.signal_types(id) ON DELETE SET NULL;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: warehouse_items warehouse_items_equipment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouse_items
    ADD CONSTRAINT warehouse_items_equipment_type_id_fkey FOREIGN KEY (equipment_type_id) REFERENCES public.equipment_types(id);


--
-- Name: warehouse_items warehouse_items_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouse_items
    ADD CONSTRAINT warehouse_items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: warehouses warehouses_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: equipment_user
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 817EMfxwkT08FrpaWyueSTMvZudLRaFA7yfMiVrxqaQFTb3dSW80sh0kKgolsPD

