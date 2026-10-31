-- =============================================================================
-- EOA Global - Emergency Facilities osm2pgsql Flex Lua Configuration
-- Filters OSM PBF data to mission-critical emergency services
-- =============================================================================

local srid = 4326

local tables = {}

tables.osm_facilities = osm2pgsql.define_table({
    name = 'osm_facilities',
    ids = { type = 'any', id_column = 'osm_id', type_column = 'osm_type' },
    columns = {
        { column = 'name', type = 'text' },
        { column = 'name_ar', type = 'text' },
        { column = 'name_en', type = 'text' },
        { column = 'facility_type', type = 'text', not_null = true },
        { column = 'operator', type = 'text' },
        { column = 'phone', type = 'text' },
        { column = 'emergency_services', type = 'jsonb' },
        { column = 'geom', type = 'point', projection = srid, not_null = true },
        { column = 'last_osm_timestamp', sql_type = 'timestamptz' }
    }
})

local function get_facility_type(tags)
    if not tags then return nil end
    local amenity = tags.amenity
    local emergency = tags.emergency
    local healthcare = tags.healthcare
    local op = tags.operator and tags.operator:lower() or ""

    if amenity == 'hospital' or healthcare == 'hospital' then
        return 'hospital'
    elseif amenity == 'clinic' or healthcare == 'clinic' or healthcare == 'centre' or amenity == 'doctors' then
        return 'clinic'
    elseif amenity == 'fire_station' or emergency == 'fire_station' then
        return 'fire_station'
    elseif amenity == 'police' then
        return 'police'
    elseif amenity == 'pharmacy' or healthcare == 'pharmacy' then
        return 'pharmacy'
    elseif amenity == 'shelter' or emergency == 'shelter' or emergency == 'disaster_help_point' then
        return 'shelter'
    elseif emergency == 'ambulance_station' then
        return 'ambulance_station'
    end

    if string.find(op, 'red crescent') or string.find(op, 'red cross') or string.find(op, 'civil defence') or string.find(op, 'civil defense') then
        return 'civil_defense'
    end

    return nil
end

function osm2pgsql.process_node(object)
    local ftype = get_facility_type(object.tags)
    if not ftype then return end

    tables.osm_facilities:insert({
        name = object.tags.name,
        name_ar = object.tags['name:ar'],
        name_en = object.tags['name:en'],
        facility_type = ftype,
        operator = object.tags.operator,
        phone = object.tags.phone or object.tags['contact:phone'],
        emergency_services = {
            amenity = object.tags.amenity,
            emergency = object.tags.emergency,
            healthcare = object.tags.healthcare,
            operator = object.tags.operator
        },
        geom = object:as_point(),
        last_osm_timestamp = object.timestamp
    })
end

function osm2pgsql.process_way(object)
    local ftype = get_facility_type(object.tags)
    if not ftype then return end

    local geom = object:as_polygon()
    if geom then
        tables.osm_facilities:insert({
            name = object.tags.name,
            name_ar = object.tags['name:ar'],
            name_en = object.tags['name:en'],
            facility_type = ftype,
            operator = object.tags.operator,
            phone = object.tags.phone or object.tags['contact:phone'],
            emergency_services = {
                amenity = object.tags.amenity,
                emergency = object.tags.emergency,
                healthcare = object.tags.healthcare,
                operator = object.tags.operator
            },
            geom = geom:centroid(),
            last_osm_timestamp = object.timestamp
        })
    end
end

function osm2pgsql.process_relation(object)
    local ftype = get_facility_type(object.tags)
    if not ftype then return end

    if object.tags.type == 'multipolygon' then
        local geom = object:as_multipolygon()
        if geom then
            tables.osm_facilities:insert({
                name = object.tags.name,
                name_ar = object.tags['name:ar'],
                name_en = object.tags['name:en'],
                facility_type = ftype,
                operator = object.tags.operator,
                phone = object.tags.phone or object.tags['contact:phone'],
                emergency_services = {
                    amenity = object.tags.amenity,
                    emergency = object.tags.emergency,
                    healthcare = object.tags.healthcare,
                    operator = object.tags.operator
                },
                geom = geom:centroid(),
                last_osm_timestamp = object.timestamp
            })
        end
    end
end
